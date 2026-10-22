import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import express, { type NextFunction, type Request, type Response } from 'express';
import session from 'express-session';
import { Server, type Socket } from 'socket.io';
import type { ClientToServerEvents, LobbyRooms, Member, Room, RoomDetails, ServerToClientEvents, User } from '../shared/protocol.ts';
import {
  CHAT_MESSAGE_MAX, EMAIL_PATTERN, MAX_PRIVATE_ROOMS_PER_USER, PASSWORD_MIN, ROOM_DESCRIPTION_MAX, ROOM_EMOJIS,
  ROOM_NAME_MAX, isValidPasscode, normalizeName, validateName,
} from '../shared/validation.ts';
import { avatarSvg } from './avatars.ts';
import { addChatMessage, chatHistory, clearChat } from './chat.ts';
import {
  SqliteSessionStore, authenticate, changePassword, countOwnedRooms, createPrivateRoom, createUser, deletePrivateRoom,
  endOtherSessions, ensureAdmin, getPrivateRoom, getUser, grantRoomAccess, hasRoomAccess, isNameAvailable,
  listPrivateRooms, renameUser, type PrivateRoom,
} from './db.ts';
import {
  PUBLIC_ROOMS, addMember, findByUserId, getPublicRoom, getRoomState, memberIds, removeMember, summarize,
} from './rooms.ts';

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

interface SocketData {
  userId: number;
  roomId?: string;
  /** Owner of the private room this socket is in, if any. */
  roomOwnerId?: number;
  chatTimes?: number[];
}

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const PORT = Number(process.env.PORT ?? 3000);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const CLIENT_DIR = path.join(import.meta.dirname, '..', 'dist');
const LOBBY = 'lobby';

const ADMIN_EMAIL = 'sarojp.dev@gmail.com';
const DEFAULT_ADMIN_PASSWORD = 'passoword';

// STUN is enough on most networks; set ICE_SERVERS to a JSON array to add a TURN relay.
const ICE_SERVERS: unknown[] = process.env.ICE_SERVERS
  ? JSON.parse(process.env.ICE_SERVERS)
  : [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

if (IS_PRODUCTION && !process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET is not set; sessions will not survive a restart.');
}
if (IS_PRODUCTION && !process.env.ADMIN_PASSWORD) {
  console.warn('ADMIN_PASSWORD is not set; the admin account uses the default password. Set it, or change it from the profile page.');
}
ensureAdmin(ADMIN_EMAIL, process.env.ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD);

const app = express();
const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(server);

// Hosts like Render terminate HTTPS at a proxy in front of the app.
if (IS_PRODUCTION) app.set('trust proxy', 1);

const sessionMiddleware = session({
  store: new SqliteSessionStore(),
  secret: process.env.SESSION_SECRET ?? crypto.randomBytes(32).toString('hex'),
  name: 'audiospace.sid',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  // 'auto' marks the cookie Secure whenever the request arrived over HTTPS.
  cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 30 * 24 * 60 * 60 * 1000 },
});

app.disable('x-powered-by');
app.use(sessionMiddleware);
app.use(express.json({ limit: '10kb' }));

// ---------- Helpers ----------

function fail(res: Response, status: number, error: string) {
  res.status(status).json({ error });
}

/** A small in-memory limiter: at most `max` hits per key per window. */
function limiter(max: number, windowMs: number, keyOf: (req: Request) => string) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyOf(req);
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (++entry.count > max) return fail(res, 429, 'Too many attempts. Try again in a few minutes.');
    next();
  };
}

const authLimit = limiter(20, 15 * 60 * 1000, req => req.ip ?? 'unknown');
const passcodeLimit = limiter(10, 15 * 60 * 1000, req => `${req.session.userId}:${req.params.roomId}`);

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function currentUser(req: Request): User | null {
  return req.session.userId ? getUser(req.session.userId) : null;
}

function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = currentUser(req);
  if (!user) return fail(res, 401, 'Not signed in.');
  res.locals.user = user;
  next();
}

function userOf(res: Response): User {
  return res.locals.user as User;
}

function startSession(req: Request, res: Response, user: User) {
  req.session.regenerate(err => {
    if (err) return fail(res, 500, 'Could not start a session.');
    req.session.userId = user.id;
    res.json(user);
  });
}

/** The room without its passcode. */
function publicView(room: Room | PrivateRoom): Room {
  const { id, kind, name, description, emoji, ownerId, ownerName } = room;
  return kind === 'private' ? { id, kind, name, description, emoji, ownerId, ownerName } : { id, kind, name, description, emoji };
}

function findRoom(id: string): Room | PrivateRoom | null {
  return getPublicRoom(id) ?? getPrivateRoom(id);
}

function canManage(room: PrivateRoom, user: User): boolean {
  return user.isAdmin || room.ownerId === user.id;
}

// ---------- Auth ----------

app.post('/api/auth/signup', authLimit, (req, res) => {
  const name = normalizeName(text(req.body?.name));
  const email = text(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  const nameError = validateName(name);
  if (nameError) return fail(res, 400, nameError);
  if (!EMAIL_PATTERN.test(email)) return fail(res, 400, 'Please enter a valid email address.');
  if (password.length < PASSWORD_MIN) return fail(res, 400, `Password must be at least ${PASSWORD_MIN} characters.`);

  const result = createUser(name, email, password);
  if ('error' in result) {
    return fail(res, 409, result.error === 'email-taken'
      ? 'That email is already registered. Try signing in.'
      : `"${name}" is taken. Try another display name.`);
  }
  startSession(req, res, result.user);
});

app.post('/api/auth/login', authLimit, (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const user = authenticate(text(req.body?.email), password);
  if (!user) return fail(res, 401, 'Incorrect email or password.');
  startSession(req, res, user);
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('audiospace.sid');
    res.status(204).end();
  });
});

// ---------- Profile ----------

app.get('/api/me', requireUser, (_req, res) => {
  res.json(userOf(res));
});

app.patch('/api/me', requireUser, (req, res) => {
  const user = userOf(res);
  const name = normalizeName(text(req.body?.name));
  const nameError = validateName(name);
  if (nameError) return fail(res, 400, nameError);
  if (!renameUser(user.id, name)) return fail(res, 409, `"${name}" is taken. Try another display name.`);
  res.json(getUser(user.id));
});

app.post('/api/me/password', requireUser, authLimit, (req, res) => {
  const user = userOf(res);
  const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const next = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  if (next.length < PASSWORD_MIN) return fail(res, 400, `New password must be at least ${PASSWORD_MIN} characters.`);
  if (!changePassword(user.id, current, next)) return fail(res, 403, 'Your current password is incorrect.');
  // Sign out other devices, and give this one a fresh session id.
  endOtherSessions(user.id, req.sessionID);
  startSession(req, res, user);
});

app.get('/api/users/name-available', limiter(120, 60 * 1000, req => req.ip ?? 'unknown'), (req, res) => {
  const name = normalizeName(text(req.query.name));
  const error = validateName(name);
  res.json({ available: !error && isNameAvailable(name, req.session.userId), error });
});

app.get('/api/avatars/:seed', (req, res) => {
  const seed = String(req.params.seed).replace(/\.svg$/, '');
  if (!/^[\w-]{1,64}$/.test(seed)) return fail(res, 400, 'Invalid avatar.');
  res.set('Cache-Control', 'public, max-age=31536000, immutable').type('image/svg+xml').send(avatarSvg(seed));
});

// ---------- Rooms ----------

function lobbyFor(user: User | null): LobbyRooms {
  return {
    public: PUBLIC_ROOMS.map(room => summarize(room, { withMembers: Boolean(user) })),
    private: user ? listPrivateRooms(user).map(room => summarize(publicView(room))) : [],
  };
}

// Public, so the landing page can show what's live; names are only shared with signed-in users.
app.get('/api/rooms', (req, res) => {
  res.json(lobbyFor(currentUser(req)));
});

app.post('/api/rooms', requireUser, (req, res) => {
  const user = userOf(res);
  const name = text(req.body?.name).replace(/\s+/g, ' ');
  const description = text(req.body?.description).replace(/\s+/g, ' ');
  const emoji = ROOM_EMOJIS.includes(req.body?.emoji) ? req.body.emoji : ROOM_EMOJIS[0];
  const passcode = text(req.body?.passcode);

  if (!name || name.length > ROOM_NAME_MAX) return fail(res, 400, `Give the room a name (up to ${ROOM_NAME_MAX} characters).`);
  if (description.length > ROOM_DESCRIPTION_MAX) return fail(res, 400, `Keep the description under ${ROOM_DESCRIPTION_MAX} characters.`);
  if (!isValidPasscode(passcode)) return fail(res, 400, 'The passcode must be exactly 6 digits.');
  if (!user.isAdmin && countOwnedRooms(user.id) >= MAX_PRIVATE_ROOMS_PER_USER) {
    return fail(res, 403, `You can have up to ${MAX_PRIVATE_ROOMS_PER_USER} private rooms. Delete one to make another.`);
  }

  const room = createPrivateRoom(user.id, { name, description, emoji, passcode });
  broadcastLobby();
  res.status(201).json({ room: publicView(room), locked: false, canManage: true, passcode: room.passcode } satisfies RoomDetails);
});

app.get('/api/rooms/:roomId', requireUser, (req, res) => {
  const user = userOf(res);
  const room = findRoom(String(req.params.roomId));
  if (!room) return fail(res, 404, 'Room not found.');
  if (room.kind === 'public') return res.json({ room, locked: false, canManage: false } satisfies RoomDetails);

  const priv = room as PrivateRoom;
  const manage = canManage(priv, user);
  res.json({
    room: publicView(priv),
    locked: !hasRoomAccess(priv, user),
    canManage: manage,
    passcode: manage ? priv.passcode : undefined,
  } satisfies RoomDetails);
});

app.post('/api/rooms/:roomId/unlock', requireUser, passcodeLimit, (req, res) => {
  const user = userOf(res);
  const room = getPrivateRoom(String(req.params.roomId));
  if (!room) return fail(res, 404, 'Room not found.');
  const passcode = text(req.body?.passcode);
  const expected = Buffer.from(room.passcode);
  const given = Buffer.from(passcode.padEnd(expected.length).slice(0, expected.length));
  if (!isValidPasscode(passcode) || !crypto.timingSafeEqual(expected, given)) {
    return fail(res, 403, "That passcode isn't right. Check with whoever shared the room.");
  }
  grantRoomAccess(room.id, user.id);
  broadcastLobby();
  res.status(204).end();
});

app.delete('/api/rooms/:roomId', requireUser, (req, res) => {
  const user = userOf(res);
  const room = getPrivateRoom(String(req.params.roomId));
  if (!room) return fail(res, 404, 'Room not found.');
  if (!canManage(room, user)) return fail(res, 403, 'Only the owner can delete this room.');

  for (const id of memberIds(room.id)) {
    const socket = io.sockets.sockets.get(id);
    if (!socket) continue;
    socket.emit('room deleted');
    leaveRoom(socket);
  }
  clearChat(room.id);
  deletePrivateRoom(room.id);
  broadcastLobby();
  res.status(204).end();
});

app.get('/api/ice-servers', requireUser, (_req, res) => {
  res.json(ICE_SERVERS);
});

app.use('/api', (_req, res) => fail(res, 404, 'Not found.'));

// ---------- Client ----------

if (IS_PRODUCTION && !fs.existsSync(path.join(CLIENT_DIR, 'index.html'))) {
  console.error(`Client build not found at ${CLIENT_DIR}. Run "npm run build" (or "npm install") before "npm start".`);
  app.use((_req, res) => {
    res.status(503).type('text').send('AudioSpace is not built yet. Run "npm run build" during deploy.');
  });
} else if (IS_PRODUCTION) {
  app.use('/assets', express.static(path.join(CLIENT_DIR, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(CLIENT_DIR, { index: false, maxAge: '1d' }));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(CLIENT_DIR, 'index.html')));
}

// ---------- Realtime ----------

// Share the express session with socket.io so sockets know who they belong to.
io.engine.use(sessionMiddleware);

io.use((socket, next) => {
  const userId = (socket.request as Request).session?.userId;
  if (!userId || !getUser(userId)) return next(new Error('unauthorized'));
  socket.data.userId = userId;
  next();
});

function broadcastLobby() {
  for (const id of io.sockets.adapter.rooms.get(LOBBY) ?? []) {
    const socket = io.sockets.sockets.get(id);
    if (socket) socket.emit('rooms', lobbyFor(getUser(socket.data.userId)));
  }
}

function leaveRoom(socket: AppSocket) {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  socket.data.roomId = undefined;
  socket.data.roomOwnerId = undefined;
  socket.leave(roomId);
  const newHost = removeMember(roomId, socket.id);
  io.to(roomId).emit('member left', socket.id);
  if (newHost) io.to(roomId).emit('host changed', newHost);
  broadcastLobby();
}

/** Room hosts, private-room owners and admins can mute people. */
function canModerate(socket: AppSocket): boolean {
  const room = socket.data.roomId ? getRoomState(socket.data.roomId) : undefined;
  if (!room) return false;
  const user = getUser(socket.data.userId);
  return room.hostId === socket.id || Boolean(user?.isAdmin) || socket.data.roomOwnerId === socket.data.userId;
}

io.on('connection', (socket: AppSocket) => {
  socket.on('watch rooms', () => {
    socket.join(LOBBY);
    socket.emit('rooms', lobbyFor(getUser(socket.data.userId)));
  });

  socket.on('join', ({ roomId, muted }) => {
    if (socket.data.roomId) return;
    const user = getUser(socket.data.userId);
    const room = findRoom(roomId);
    if (!user || !room) return;
    const priv = room.kind === 'private' ? (room as PrivateRoom) : null;
    if (priv && !hasRoomAccess(priv, user)) return void socket.emit('room locked');

    // One seat per person: a newer tab or device takes over from the older one.
    const previousId = findByUserId(roomId, user.id);
    const previous = previousId ? io.sockets.sockets.get(previousId) : undefined;
    const wasHost = previousId !== undefined && getRoomState(roomId)?.hostId === previousId;
    if (previous) {
      previous.emit('joined elsewhere');
      leaveRoom(previous);
    } else if (previousId) {
      removeMember(roomId, previousId); // stale entry with no live connection
    }

    const member: Member = {
      id: socket.id, userId: user.id, name: user.name, avatarSeed: user.avatarSeed, isAdmin: user.isAdmin, muted: Boolean(muted),
    };
    const state = addMember(roomId, member);
    if (!state) return void socket.emit('room full');

    // Hosts keep hosting when they switch tabs, and owners always host their own rooms.
    if ((wasHost || priv?.ownerId === user.id) && state.hostId !== socket.id) {
      state.hostId = socket.id;
      socket.to(roomId).emit('host changed', socket.id);
    }

    socket.data.roomId = roomId;
    socket.data.roomOwnerId = priv?.ownerId;
    socket.join(roomId);
    socket.emit('joined', { selfId: socket.id, hostId: state.hostId, members: [...state.members.values()] });
    if (priv) socket.emit('chat history', chatHistory(roomId));
    socket.to(roomId).emit('member joined', member);
    broadcastLobby();
  });

  // WebRTC signalling is only relayed between members of the same room.
  socket.on('signal', ({ to, description, candidate }) => {
    const room = socket.data.roomId ? getRoomState(socket.data.roomId) : undefined;
    if (room?.members.has(to)) io.to(to).emit('signal', { from: socket.id, description, candidate });
  });

  socket.on('set muted', muted => {
    const roomId = socket.data.roomId;
    const member = roomId ? getRoomState(roomId)?.members.get(socket.id) : undefined;
    if (!roomId || !member) return;
    member.muted = Boolean(muted);
    io.to(roomId).emit('member muted', { id: socket.id, muted: member.muted });
  });

  socket.on('host mute', target => {
    const room = socket.data.roomId ? getRoomState(socket.data.roomId) : undefined;
    if (target !== socket.id && room?.members.has(target) && canModerate(socket)) io.to(target).emit('force muted');
  });

  socket.on('chat send', (raw, ack) => {
    const respond = typeof ack === 'function' ? ack : () => {};
    const roomId = socket.data.roomId;
    const member = roomId ? getRoomState(roomId)?.members.get(socket.id) : undefined;
    if (!roomId || !member || !socket.data.roomOwnerId) return respond({ ok: false, error: 'Chat is only available in private rooms.' });

    const message = typeof raw === 'string' ? raw.trim() : '';
    if (!message) return respond({ ok: false, error: 'Write something first.' });
    if (message.length > CHAT_MESSAGE_MAX) return respond({ ok: false, error: `Keep messages under ${CHAT_MESSAGE_MAX} characters.` });

    // At most 5 messages every 5 seconds.
    const now = Date.now();
    const recent = (socket.data.chatTimes ?? []).filter(t => now - t < 5000);
    if (recent.length >= 5) return respond({ ok: false, error: "You're sending messages too quickly." });
    socket.data.chatTimes = [...recent, now];

    const author = { userId: member.userId, name: member.name, avatarSeed: member.avatarSeed };
    const sent = addChatMessage(roomId, author, message, id => io.to(roomId).emit('chat expired', [id]));
    io.to(roomId).emit('chat message', sent);
    respond({ ok: true });
  });

  socket.on('disconnecting', () => leaveRoom(socket));
});

server.listen(PORT, () => {
  console.log(`AudioSpace server listening on http://localhost:${PORT}`);
});
