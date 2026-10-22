# AudioSpace

A Clubhouse-style drop-in audio rooms app. Sign up, log in, or enter as a guest, then pick a room and talk with up to 8 people. Audio flows peer-to-peer over WebRTC. The server only handles accounts and signalling.

- **Server:** Node 24, Express 5, Socket.IO 4, express-session
- **Database:** SQLite through Node's built-in `node:sqlite`, with scrypt-hashed passwords
- **Client:** plain HTML, CSS and JS with no build step

## Run locally

```sh
nvm use          # Node 24 LTS, from .nvmrc
npm install
npm run dev      # restarts on file changes; or: npm start
```

Open <http://localhost:3000>. To try a room with yourself, open it in a second browser or a private window with a different login.

Browsers only allow microphone access on `https://` or `localhost`. Users who deny mic access join as listen-only.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | (unset) | Set to `production` for secure cookies behind a proxy |
| `SESSION_SECRET` | random per boot | Signs session cookies. Set it in production so restarts don't log everyone out |
| `DB_PATH` | `data/audiospace.db` | SQLite file location |
| `ICE_SERVERS` | Google STUN | JSON array of `RTCIceServer`s. Add a TURN server here for users behind strict NATs |

## Project layout

```
server.js         Express routes, sessions, Socket.IO signalling, room state
db.js             SQLite user store and password hashing
public/
  index.html      landing page (parallax + sign in/up)
  dashboard.html  room list
  room.html       audio room
  css/ js/ images/
render.yaml       Render blueprint
```

## Deploy to Render

`render.yaml` defines a free web service. In Render, choose **New → Blueprint** and point it at this repo.

The free plan has no persistent disk, so the SQLite file is wiped whenever the service restarts or redeploys, including after the 15-minute idle sleep. Guest mode works fine there, but accounts won't stick. For lasting accounts, move users to a hosted database (for example Turso or Neon) or use a paid plan with a disk and set `DB_PATH` to point at it.
