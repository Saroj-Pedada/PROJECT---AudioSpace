# AudioSpace

Drop-in live audio rooms under a starry mountain sky. Join a public room, or make a private one for your friends with a 6-digit passcode and a chat that disappears. Audio flows peer-to-peer over WebRTC; the server handles accounts, rooms and signalling.

| | |
| --- | --- |
| Client | React 19, React Router 8, Tailwind CSS 4, Vite 8, TypeScript 7 |
| Server | Node 24 (runs TypeScript natively), Express 5, Socket.IO 4 |
| Storage | SQLite via the built-in `node:sqlite`: users, sessions, private rooms |
| Avatars | DiceBear 10, Lorelei style, rendered server-side |

## Features

- **Accounts.** Sign up with a unique display name (case-insensitive, like a username). There are no guest logins.
- **Profile page.** Change your display name or your password. Changing the password signs out your other devices. Your avatar is generated once at signup from a random seed and never changes.
- **Public rooms.** Ten always-open rooms, up to 8 people each.
- **Private rooms.**
  - Any user can create up to 5, each protected by a 6-digit passcode. Share the link and the passcode.
  - Entering the passcode once unlocks the room for that account.
  - Rooms stay when empty and only disappear when their owner (or an admin) deletes them.
- **Disappearing chat** in private rooms. Messages live only in server memory and vanish 5 minutes after they're sent.
- **Moderation.** Room hosts, private-room owners and admins can mute people. Nobody can unmute you but you.
- **Admin.** `sarojp.dev@gmail.com` is created on first boot. The admin can see and enter every private room without a passcode, delete any room, and mute anyone.
- **One seat per person.** Opening a room you're already in (another tab or device) moves you there, and the old tab steps aside.

## Development

```sh
nvm use        # Node 24 LTS, from .nvmrc
npm install    # also builds the client
npm run dev    # API on :3000, Vite on http://localhost:5173 (proxies /api and /socket.io)
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Server (auto-restart) + Vite dev server |
| `npm run build` | Build the client into `dist/` (also runs after `npm install`) |
| `npm start` | Production server: serves `dist/` and the API on `$PORT` |
| `npm run typecheck` | Type-check the client and the server |

## Project layout

```
server/      index.ts (routes + realtime), db.ts (users, sessions, private rooms), rooms.ts (live presence),
             chat.ts (disappearing messages), avatars.ts (DiceBear)
shared/      protocol.ts (types) and validation.ts (rules), used by both sides
src/
  pages/       Landing, Lobby, Room, Profile, NotFound
  components/  FlyThroughHero, MountainScene, MoonStage, ChatPanel, PasscodeGate, dialogs…
  lib/         useAudioRoom (WebRTC + chat), useSpeaking, auth context, API client
public/      Optimised WebP artwork and favicons
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `SESSION_SECRET` | random per boot | Signs session cookies. Set it in production |
| `ADMIN_PASSWORD` | `passoword` | Password given to the admin account **when it's first created**. Set it in production; the default is in a public repo |
| `DB_PATH` | `data/audiospace.db` | SQLite file location |
| `ICE_SERVERS` | Google STUN | JSON array of `RTCIceServer`s. Add a TURN server for users behind strict NATs |

## Deploy to Render

`render.yaml` defines a free web service. Choose **New → Blueprint** and select this repo. Render will ask you for `ADMIN_PASSWORD`.

For a plain **Web Service** instead, use Build Command `npm install`, Start Command `npm start`, and add `SESSION_SECRET` and `ADMIN_PASSWORD` under Environment.

On the free plan:

- The disk is wiped on every redeploy and every wake from idle sleep. That erases accounts and private rooms, and the admin is recreated from `ADMIN_PASSWORD`. For lasting data, use a paid plan with a persistent disk and point `DB_PATH` at it.
- With STUN only, some people on strict networks can't hear each other. A free TURN relay fixes this through `ICE_SERVERS`.
