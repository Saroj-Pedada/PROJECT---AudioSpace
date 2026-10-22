import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import session from 'express-session';
import type { User } from '../shared/protocol.ts';

const dbPath = process.env.DB_PATH ?? path.join(import.meta.dirname, '..', 'data', 'audiospace.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;

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

const insertUser = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
const findUserByEmail = db.prepare('SELECT id, name, password_hash FROM users WHERE email = ?');

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

/** Returns the new user, or null if the email is already registered. */
export function createUser(name: string, email: string, password: string): User | null {
  try {
    const { lastInsertRowid } = insertUser.run(name, email, hashPassword(password));
    return { id: Number(lastInsertRowid), name, guest: false };
  } catch (err) {
    if (err instanceof Error && /UNIQUE/.test(err.message)) return null;
    throw err;
  }
}

/** Returns the user if the credentials match, otherwise null. */
export function authenticate(email: string, password: string): User | null {
  const row = findUserByEmail.get(email) as { id: number; name: string; password_hash: string } | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  return { id: row.id, name: row.name, guest: false };
}

const ONE_DAY = 24 * 60 * 60 * 1000;
const getSession = db.prepare('SELECT data FROM sessions WHERE sid = ? AND expires_at > ?');
const putSession = db.prepare('INSERT OR REPLACE INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)');
const touchSession = db.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?');
const deleteSession = db.prepare('DELETE FROM sessions WHERE sid = ?');
const pruneSessions = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');

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
