import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import session from 'express-session';
import type { Room, User } from '../shared/protocol.ts';

const dbPath = process.env.DB_PATH ?? path.join(import.meta.dirname, '..', 'data', 'audiospace.db');
/** Where the database and other local state (like the generated session secret) live. */
export const DATA_DIR = path.dirname(dbPath);
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

// ---------- Schema ----------

const SCHEMA_VERSION = 3;

function migrate() {
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  if (version >= SCHEMA_VERSION) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);

  // v3: avatars, admins, unique display names, private rooms.
  const columns = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map(c => c.name);
  if (!columns.includes('avatar_seed')) db.exec("ALTER TABLE users ADD COLUMN avatar_seed TEXT NOT NULL DEFAULT ''");
  if (!columns.includes('is_admin')) db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');

  const setSeed = db.prepare('UPDATE users SET avatar_seed = ? WHERE id = ?');
  for (const { id } of db.prepare("SELECT id FROM users WHERE avatar_seed = ''").all() as { id: number }[]) {
    setSeed.run(newAvatarSeed(), id);
  }
  // Older versions allowed duplicate names; keep the first and suffix the rest.
  db.exec(`
    UPDATE users SET name = name || '-' || id
    WHERE id NOT IN (SELECT MIN(id) FROM users GROUP BY name COLLATE NOCASE);
    CREATE UNIQUE INDEX IF NOT EXISTS users_name_unique ON users (name COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS private_rooms (
      id TEXT PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      emoji TEXT NOT NULL,
      passcode TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS private_rooms_owner ON private_rooms (owner_id);

    CREATE TABLE IF NOT EXISTS room_access (
      room_id TEXT NOT NULL REFERENCES private_rooms (id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      granted_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (room_id, user_id)
    );

    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
}

function newAvatarSeed(): string {
  return crypto.randomBytes(9).toString('base64url');
}

migrate();

// ---------- Users ----------

interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  avatar_seed: string;
  is_admin: number;
  created_at: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarSeed: row.avatar_seed,
    isAdmin: row.is_admin === 1,
    createdAt: row.created_at,
  };
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const userById = db.prepare('SELECT * FROM users WHERE id = ?');
const userByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const userByName = db.prepare('SELECT id FROM users WHERE name = ? COLLATE NOCASE');
const insertUser = db.prepare('INSERT INTO users (name, email, password_hash, avatar_seed, is_admin) VALUES (?, ?, ?, ?, ?)');
const updateName = db.prepare('UPDATE users SET name = ? WHERE id = ?');
const updatePassword = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');

export type CreateUserResult = { user: User } | { error: 'email-taken' | 'name-taken' };

export function createUser(name: string, email: string, password: string, isAdmin = false): CreateUserResult {
  if (userByEmail.get(email)) return { error: 'email-taken' };
  if (userByName.get(name)) return { error: 'name-taken' };
  const { lastInsertRowid } = insertUser.run(name, email, hashPassword(password), newAvatarSeed(), isAdmin ? 1 : 0);
  return { user: getUser(Number(lastInsertRowid))! };
}

export function getUser(id: number): User | null {
  const row = userById.get(id) as UserRow | undefined;
  return row ? toUser(row) : null;
}

/** Returns the user if the credentials match, otherwise null. */
export function authenticate(email: string, password: string): User | null {
  const row = userByEmail.get(email) as UserRow | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  return toUser(row);
}

export function isNameAvailable(name: string, exceptUserId?: number): boolean {
  const row = userByName.get(name) as { id: number } | undefined;
  return !row || row.id === exceptUserId;
}

/** Returns false if another user already has that name. */
export function renameUser(id: number, name: string): boolean {
  if (!isNameAvailable(name, id)) return false;
  updateName.run(name, id);
  return true;
}

/** Returns false if the current password is wrong. */
export function changePassword(id: number, currentPassword: string, newPassword: string): boolean {
  const row = userById.get(id) as UserRow | undefined;
  if (!row || !verifyPassword(currentPassword, row.password_hash)) return false;
  updatePassword.run(hashPassword(newPassword), id);
  return true;
}

/** Creates the built-in admin on first boot, and makes sure the account keeps admin rights. */
export function ensureAdmin(email: string, password: string) {
  const existing = userByEmail.get(email) as UserRow | undefined;
  if (existing) {
    if (!existing.is_admin) db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(existing.id);
    return;
  }
  const name = isNameAvailable('sarojp') ? 'sarojp' : `admin-${crypto.randomInt(1000, 10000)}`;
  createUser(name, email, password, true);
  console.log(`Created admin account ${email} (display name "${name}").`);
}

// ---------- Private rooms ----------

interface PrivateRoomRow {
  id: string;
  owner_id: number;
  owner_name: string;
  name: string;
  description: string;
  emoji: string;
  passcode: string;
}

export interface PrivateRoom extends Room {
  ownerId: number;
  passcode: string;
}

function toRoom(row: PrivateRoomRow): PrivateRoom {
  return {
    id: row.id,
    kind: 'private',
    name: row.name,
    description: row.description,
    emoji: row.emoji,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    passcode: row.passcode,
  };
}

const ROOM_SELECT = `
  SELECT r.id, r.owner_id, u.name AS owner_name, r.name, r.description, r.emoji, r.passcode
  FROM private_rooms r JOIN users u ON u.id = r.owner_id`;

const roomById = db.prepare(`${ROOM_SELECT} WHERE r.id = ?`);
const roomsForUser = db.prepare(`
  ${ROOM_SELECT}
  WHERE r.owner_id = ? OR r.id IN (SELECT room_id FROM room_access WHERE user_id = ?)
  ORDER BY r.created_at`);
const allRooms = db.prepare(`${ROOM_SELECT} ORDER BY r.created_at`);
const countOwned = db.prepare('SELECT COUNT(*) AS n FROM private_rooms WHERE owner_id = ?');
const insertRoom = db.prepare('INSERT INTO private_rooms (id, owner_id, name, description, emoji, passcode) VALUES (?, ?, ?, ?, ?, ?)');
const deleteRoom = db.prepare('DELETE FROM private_rooms WHERE id = ?');
const accessRow = db.prepare('SELECT 1 FROM room_access WHERE room_id = ? AND user_id = ?');
const insertAccess = db.prepare('INSERT OR IGNORE INTO room_access (room_id, user_id) VALUES (?, ?)');

export function getPrivateRoom(id: string): PrivateRoom | null {
  const row = roomById.get(id) as PrivateRoomRow | undefined;
  return row ? toRoom(row) : null;
}

/** Rooms the user owns or has unlocked; admins see every private room. */
export function listPrivateRooms(user: User): PrivateRoom[] {
  const rows = (user.isAdmin ? allRooms.all() : roomsForUser.all(user.id, user.id)) as unknown as PrivateRoomRow[];
  return rows.map(toRoom);
}

export function countOwnedRooms(userId: number): number {
  return (countOwned.get(userId) as { n: number }).n;
}

export function createPrivateRoom(ownerId: number, fields: { name: string; description: string; emoji: string; passcode: string }): PrivateRoom {
  const id = crypto.randomBytes(6).toString('base64url');
  insertRoom.run(id, ownerId, fields.name, fields.description, fields.emoji, fields.passcode);
  return getPrivateRoom(id)!;
}

export function deletePrivateRoom(id: string) {
  deleteRoom.run(id);
}

export function hasRoomAccess(room: PrivateRoom, user: User): boolean {
  return user.isAdmin || room.ownerId === user.id || Boolean(accessRow.get(room.id, user.id));
}

export function grantRoomAccess(roomId: string, userId: number) {
  insertAccess.run(roomId, userId);
}

// ---------- Sessions ----------

const ONE_DAY = 24 * 60 * 60 * 1000;
const getSession = db.prepare('SELECT data FROM sessions WHERE sid = ? AND expires_at > ?');
const putSession = db.prepare('INSERT OR REPLACE INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)');
const touchSession = db.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?');
const deleteSession = db.prepare('DELETE FROM sessions WHERE sid = ?');
const pruneSessions = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');
const deleteOtherSessions = db.prepare("DELETE FROM sessions WHERE json_extract(data, '$.userId') = ? AND sid != ?");

/** Signs a user out everywhere except the given session (used after a password change). */
export function endOtherSessions(userId: number, keepSid: string) {
  deleteOtherSessions.run(userId, keepSid);
}

function expiryOf(sess: session.SessionData): number {
  return sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + ONE_DAY;
}

/** Keeps sessions in SQLite so restarts don't log everyone out. */
export class SqliteSessionStore extends session.Store {
  constructor() {
    super();
    setInterval(() => pruneSessions.run(Date.now()), 60 * 60 * 1000).unref();
  }

  get(sid: string, cb: (err: unknown, session?: session.SessionData | null) => void) {
    const row = getSession.get(sid, Date.now()) as { data: string } | undefined;
    cb(null, row ? JSON.parse(row.data) : null);
  }

  set(sid: string, sess: session.SessionData, cb?: (err?: unknown) => void) {
    putSession.run(sid, JSON.stringify(sess), expiryOf(sess));
    cb?.();
  }

  touch(sid: string, sess: session.SessionData, cb?: () => void) {
    touchSession.run(expiryOf(sess), sid);
    cb?.();
  }

  destroy(sid: string, cb?: (err?: unknown) => void) {
    deleteSession.run(sid);
    cb?.();
  }
}
