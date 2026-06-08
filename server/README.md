# Pixel Outbreak Realtime Server

Node.js, Express, and Socket.IO server for active two-player gameplay. It keeps live room state in memory and does not write movement, shooting, zombie, revive, boss, or special ability events to Supabase.

## Local Development

```bash
cd server
npm install
npm run dev
```

The server listens on `http://localhost:3001` by default.

Set the frontend variable:

```bash
VITE_GAME_SERVER_URL=http://localhost:3001
```

## Production

Deploy this folder to a Node host such as Render, Railway, or Fly.io. Set:

```bash
PORT=3001
CLIENT_ORIGINS=https://your-netlify-site.netlify.app
```

Then add the deployed Socket.IO URL to Netlify:

```bash
VITE_GAME_SERVER_URL=https://your-game-server.example.com
```

Supabase remains useful for `game_results` and leaderboard persistence only. Live gameplay events should stay on Socket.IO.
