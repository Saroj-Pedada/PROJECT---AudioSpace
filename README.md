# AudioSpace

Drop-in live audio rooms, in the style of Clubhouse. Sign up or enter as a guest, pick a room, and talk with up to 8 people. Audio flows peer-to-peer over WebRTC. The server handles accounts, room state and signalling.

| | |
| --- | --- |
| Client | React 19, React Router 8, Tailwind CSS 4, Vite 8, TypeScript 7 |
| Server | Node 24 (runs TypeScript natively), Express 5, Socket.IO 4 |
| Storage | SQLite via the built-in `node:sqlite` (users and sessions), scrypt-hashed passwords |

## Features

- **Live lobby** that updates in real time, showing who's in each room.
- **Join as a listener.** The mic is only requested when you first unmute, so there's no permission prompt just to listen.
- **Speaking indicators** driven by real audio levels.
- **Host controls.** The first person in a room hosts it and can mute others. When the host leaves, hosting passes to the next person.
- **Small touches:** the space bar toggles the mic, invite links copy the room URL, and room links survive sign-in.

## Development

```sh
nvm use        # Node 24 LTS, from .nvmrc
npm install
npm run dev    # API on :3000, Vite on http://localhost:5173 (proxies /api and /socket.io)
```

To try a room with yourself, open a second browser or a private window and enter as a guest.

| Script | What it does |
| --- | --- |
| `npm run dev` | Server (auto-restart) + Vite dev server |
| `npm run build` | Build the client into `dist/` |
| `npm start` | Production server: serves `dist/` and the API on `$PORT` |
| `npm run typecheck` | Type-check the client and the server |

## Project layout

```
server/      Express + Socket.IO (index.ts), SQLite users/sessions (db.ts), room state (rooms.ts)
shared/      protocol.ts: types shared by the client and the server
src/         React app
  pages/       Landing, Lobby, Room, NotFound
  components/  MountainScene (parallax art), AuthDialog, AppShell, Avatar, Button…
  lib/         useAudioRoom (WebRTC), useSpeaking (audio levels), auth context, API client
public/      Static assets (optimised WebP artwork, favicons)
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `SESSION_SECRET` | random per boot | Signs session cookies. Set it in production |
| `DB_PATH` | `data/audiospace.db` | SQLite file location |
| `ICE_SERVERS` | Google STUN | JSON array of `RTCIceServer`s. Add a TURN server for users behind strict NATs |

## Deploy to Render

`render.yaml` defines a free web service. In Render, choose **New → Blueprint** and select this repo.

On the free plan:

- The filesystem is wiped on every redeploy and every wake from idle sleep, so accounts don't persist. Guest mode is unaffected. For lasting accounts, use a paid plan with a disk (and set `DB_PATH`) or a hosted database.
- With STUN only, some people on strict networks can't hear each other. A free TURN relay, such as Metered's free tier, fixes this through `ICE_SERVERS`, for example:
  `[{"urls":"stun:stun.relay.metered.ca:80"},{"urls":"turn:global.relay.metered.ca:443","username":"…","credential":"…"}]`
