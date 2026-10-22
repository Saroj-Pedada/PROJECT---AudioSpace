import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import express, { type NextFunction, type Request, type Response } from 'express';
import session from 'express-session';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, User } from '../shared/protocol.ts';
import { authenticate, createUser, SqliteSessionStore } from './db.ts';
import { addMember, findByUserKey, getRoom, getRoomState, removeMember, summaries, toMember } from './rooms.ts';

declare module 'express-session' {
  interface SessionData {
    user: User;
  }
}

interface SocketData {
  user: User;
  /** Identifies the person across tabs and devices: their account, or their guest session. */
  userKey: string;
  roomId?: string;
}

const PORT = Number(process.env.PORT ?? 3000);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const CLIENT_DIR = path.join(import.meta.dirname, '..', 'dist');
const LOBBY = 'lobby';

// STUN is enough on most networks; set ICE_SERVERS to a JSON array to add a TURN relay.
const ICE_SERVERS: unknown[] = process.env.ICE_SERVERS
  ? JSON.parse(process.env.ICE_SERVERS)
  : [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

if (IS_PRODUCTION && !process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET is not set; sessions will not survive a restart.');
}

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

// ---------- Auth ----------

// A small in-memory limiter so passwords can't be brute-forced.
const attempts = new Map<string, { count: number; resetAt: number }>();
function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return next();
  }
  if (++entry.count > 20) {
    res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
    return;
  }
  next();
}

function startSession(req: Request, res: Response, user: User) {
  req.session.regenerate(err => {
    if (err) {
      res.status(500).json({ error: 'Could not start a session.' });
      return;
    }
    req.session.user = user;
    res.json(user);
  });
}

function field(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/auth/signup', rateLimit, (req, res) => {
  const name = field(req.body?.name);
  const email = field(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!name || name.length > 40) return void res.status(400).json({ error: 'Please enter a name (up to 40 characters).' });
  if (!EMAIL_PATTERN.test(email)) return void res.status(400).json({ error: 'Please enter a valid email address.' });
  if (password.length < 8) return void res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const user = createUser(name, email, password);
  if (!user) return void res.status(409).json({ error: 'That email is already registered. Try signing in.' });
  startSession(req, res, user);
});

app.post('/api/auth/login', rateLimit, (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const user = authenticate(field(req.body?.email), password);
  if (!user) return void res.status(401).json({ error: 'Incorrect email or password.' });
  startSession(req, res, user);
});

app.post('/api/auth/guest', (req, res) => {
  startSession(req, res, { name: `Guest ${crypto.randomInt(1000, 10000)}`, guest: true });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('audiospace.sid');
    res.status(204).end();
  });
});

// ---------- API ----------

function requireUser(req: Request, res: Response, next: NextFunction) {
  if (req.session.user) return next();
  res.status(401).json({ error: 'Not signed in.' });
}

app.get('/api/me', requireUser, (req, res) => {
  res.json(req.session.user);
});

// Public, so the landing page can show what's live; names are only shared with signed-in users.
app.get('/api/rooms', (req, res) => {
  res.json(summaries({ withMembers: Boolean(req.session.user) }));
});

app.get('/api/rooms/:roomId', requireUser, (req, res) => {
  const room = getRoom(String(req.params.roomId));
  if (!room) return void res.status(404).json({ error: 'Room not found.' });
  res.json(room);
});

app.get('/api/ice-servers', requireUser, (_req, res) => {
  res.json(ICE_SERVERS);
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

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
  const { session } = socket.request as Request;
  const user = session?.user;
  if (!user) return next(new Error('unauthorized'));
  socket.data.user = user;
  socket.data.userKey = user.id !== undefined ? `user:${user.id}` : `guest:${session.id}`;
  next();
});

function broadcastRooms() {
  io.to(LOBBY).emit('rooms', summaries());
}

type AppSocket = Parameters<Parameters<typeof io.on>[1]>[0];

function leaveRoom(socket: AppSocket) {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  socket.data.roomId = undefined;
  socket.leave(roomId);
  const newHost = removeMember(roomId, socket.id);
  io.to(roomId).emit('member left', socket.id);
  if (newHost) io.to(roomId).emit('host changed', newHost);
  broadcastRooms();
}

io.on('connection', socket => {
  socket.on('watch rooms', () => {
    socket.join(LOBBY);
    socket.emit('rooms', summaries());
  });

  socket.on('join', ({ roomId, muted }) => {
    if (!getRoom(roomId) || socket.data.roomId) return;

    // One seat per person: a newer tab or device takes over from the older one.
    const previousId = findByUserKey(roomId, socket.data.userKey);
    const previous = previousId ? io.sockets.sockets.get(previousId) : undefined;
    const wasHost = previousId !== undefined && getRoomState(roomId)?.hostId === previousId;
    if (previous) {
      previous.emit('joined elsewhere');
      leaveRoom(previous);
    } else if (previousId) {
      removeMember(roomId, previousId); // stale entry with no live connection
    }

    const member = { id: socket.id, name: socket.data.user.name, muted: Boolean(muted), userKey: socket.data.userKey };
    const room = addMember(roomId, member);
    if (!room) return void socket.emit('room full');
    if (wasHost && room.hostId !== socket.id) {
      room.hostId = socket.id; // the host keeps hosting when they switch tabs
      socket.to(roomId).emit('host changed', socket.id);
    }

    socket.data.roomId = roomId;
    socket.join(roomId);
    socket.emit('joined', { selfId: socket.id, hostId: room.hostId, members: [...room.members.values()].map(toMember) });
    socket.to(roomId).emit('member joined', toMember(member));
    broadcastRooms();
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
    if (room?.hostId === socket.id && room.members.has(target)) io.to(target).emit('force muted');
  });

  socket.on('disconnecting', () => leaveRoom(socket));
});

server.listen(PORT, () => {
  console.log(`AudioSpace server listening on http://localhost:${PORT}`);
});
