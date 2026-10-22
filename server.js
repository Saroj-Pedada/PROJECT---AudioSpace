const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const express = require('express');
const session = require('express-session');
const { Server } = require('socket.io');
const { createUser, authenticate } = require('./db');

const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const MAX_ROOM_SIZE = 8;

// STUN is enough on most networks; set ICE_SERVERS to a JSON array to add a TURN relay.
const ICE_SERVERS = process.env.ICE_SERVERS
    ? JSON.parse(process.env.ICE_SERVERS)
    : [{ urls: 'stun:stun.l.google.com:19302' }];
const PUBLIC_DIR = path.join(__dirname, 'public');

const ROOMS = [
    { id: 'room1', name: 'Bollywood Pop Songs' },
    { id: 'room2', name: 'Just for Fun' },
    { id: 'room3', name: 'The Musafir Stories' },
    { id: 'room4', name: 'Political Debates' },
    { id: 'room5', name: 'Finance Society' },
    { id: 'room6', name: 'Learning Mahabharatha in English' },
    { id: 'room7', name: 'Chit Chat' },
    { id: 'room8', name: 'Standup Comedy' },
    { id: 'room9', name: 'Party Music Room' },
    { id: 'room10', name: "Musicians' Assembly" },
];
const roomsById = new Map(ROOMS.map(room => [room.id, room]));

// Per-room state: who is in it, their display names, and who moderates it.
// The first person to join a room becomes its host and can mute others.
const roomState = new Map();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Hosts like Render terminate HTTPS at a proxy in front of the app.
if (IS_PRODUCTION) app.set('trust proxy', 1);

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: IS_PRODUCTION },
});

app.use(sessionMiddleware);
app.use(express.urlencoded({ extended: false }));
app.use(express.static(PUBLIC_DIR, { index: false }));

function requireUser(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/');
}

app.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.post('/signup', (req, res) => {
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim();
    const password = req.body.pass || '';

    if (!name || !email || password.length < 6) return res.redirect('/?error=invalid-signup');

    const user = createUser(name, email, password);
    if (!user) return res.redirect('/?error=email-taken');

    req.session.regenerate(() => {
        req.session.user = user;
        res.redirect('/dashboard');
    });
});

app.post('/login', (req, res) => {
    const user = authenticate((req.body.email || '').trim(), req.body.pass || '');
    if (!user) return res.redirect('/?error=bad-login');

    req.session.regenerate(() => {
        req.session.user = user;
        res.redirect('/dashboard');
    });
});

app.get('/guest', (req, res) => {
    req.session.regenerate(() => {
        req.session.user = { name: `Guest#${crypto.randomInt(1000, 10000)}`, guest: true };
        res.redirect('/dashboard');
    });
});

app.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

app.get('/dashboard', requireUser, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'dashboard.html'));
});

app.get('/room/:roomId', requireUser, (req, res) => {
    if (!roomsById.has(req.params.roomId)) return res.redirect('/dashboard');
    res.sendFile(path.join(PUBLIC_DIR, 'room.html'));
});

app.get('/api/me', requireUser, (req, res) => {
    res.json(req.session.user);
});

app.get('/api/ice-servers', requireUser, (req, res) => {
    res.json(ICE_SERVERS);
});

app.get('/api/rooms', requireUser, (req, res) => {
    res.json(ROOMS.map(room => ({
        ...room,
        listeners: roomState.get(room.id)?.members.size ?? 0,
    })));
});

app.get('/api/rooms/:roomId', requireUser, (req, res) => {
    const room = roomsById.get(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
});

// Share the express session with socket.io so sockets know who they belong to.
io.engine.use(sessionMiddleware);

io.use((socket, next) => {
    const user = socket.request.session?.user;
    if (!user) return next(new Error('unauthorized'));
    socket.data.name = user.name;
    next();
});

function leaveRoom(socket) {
    const roomId = socket.data.roomId;
    const state = roomState.get(roomId);
    if (!state) return;

    state.members.delete(socket.id);
    socket.to(roomId).emit('user disconnected', socket.id);

    if (state.members.size === 0) {
        roomState.delete(roomId);
    } else if (state.hostId === socket.id) {
        state.hostId = state.members.keys().next().value;
        io.to(roomId).emit('host changed', state.hostId);
    }
}

io.on('connection', socket => {
    socket.on('user joined room', roomId => {
        if (!roomsById.has(roomId) || socket.data.roomId) return;

        let state = roomState.get(roomId);
        if (state && state.members.size >= MAX_ROOM_SIZE) {
            socket.emit('room is full');
            return;
        }
        if (!state) {
            state = { hostId: socket.id, members: new Map() };
            roomState.set(roomId, state);
        }

        const otherUsers = [...state.members].map(([id, name]) => ({ id, name }));
        state.members.set(socket.id, socket.data.name);
        socket.data.roomId = roomId;
        socket.join(roomId);

        socket.emit('joined', { selfId: socket.id, hostId: state.hostId, otherUsers });
        socket.to(roomId).emit('user joined', { id: socket.id, name: socket.data.name });
    });

    // WebRTC signalling is only relayed between members of the same room.
    function relay(event, target, payload) {
        const state = roomState.get(socket.data.roomId);
        if (state?.members.has(target)) io.to(target).emit(event, payload);
    }

    socket.on('connection offer', ({ target, sdp }) => {
        relay('connection offer', target, { sdp, from: socket.id });
    });

    socket.on('connection answer', ({ target, sdp }) => {
        relay('connection answer', target, { sdp, from: socket.id });
    });

    socket.on('ice-candidate', ({ target, candidate }) => {
        relay('ice-candidate', target, { candidate, from: socket.id });
    });

    socket.on('set muted', ({ target, muted }) => {
        const state = roomState.get(socket.data.roomId);
        if (state?.hostId !== socket.id) return;
        relay('force muted', target, { muted: Boolean(muted) });
    });

    socket.on('mute state', muted => {
        if (socket.data.roomId) {
            socket.to(socket.data.roomId).emit('mute state', { id: socket.id, muted: Boolean(muted) });
        }
    });

    socket.on('disconnecting', () => leaveRoom(socket));
});

server.listen(PORT, () => console.log(`AudioSpace running at http://localhost:${PORT}`));
