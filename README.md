# Pixel Outbreak Survivor

A modern Vite + vanilla JavaScript browser game: a 2D pixel-style top-down survival shooter rendered with HTML Canvas.

## Run the game

```bash
npm install
npm run dev
```

Open the local URL Vite prints in your terminal.

## Environment variables

Multiplayer uses Supabase Realtime. Create a `.env` file with:

```bash
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

The project expects the existing `rooms`, `room_players`, `room_events`, and `game_results` tables to already exist in Supabase with Realtime enabled.

## Desktop controls

- `WASD` or arrow keys: move
- Mouse: aim
- Left click: shoot
- `P` or `Esc`: pause/resume

## Mobile controls

Pixel Outbreak Survivor supports touch twin-stick controls on phones, tablets, and small touch screens. Mobile play is intended for horizontal/landscape orientation.

- Left virtual joystick: move the player
- Right virtual joystick: aim
- Hold or move the right virtual joystick: shoot continuously at the current fire rate
- Release the right virtual joystick: stop shooting while keeping the last aim direction
- Both joysticks support multi-touch, so you can move and shoot at the same time

## Multiplayer

The game includes a prototype two-player online room mode using Supabase Realtime.

- Main menu: choose Single Player or Multiplayer
- Multiplayer: enter a player name and room code, then Join / Create Room
- First player creates the room and becomes host
- Second connected player joins slot 2 and starts the match automatically
- Host owns shared wave, zombie, and pickup sync
- Both players send throttled position updates and immediate shooting events
- Remote players are interpolated and drawn with different colors and name labels

To test multiplayer:

1. Start the dev server with `npm run dev`.
2. Open the game in two browser tabs, two windows, or a desktop browser plus a phone on the same dev URL.
3. Click Multiplayer in both clients.
4. Enter different player names and the same room code.
5. Join from player 1, then player 2.
6. The lobby should show both players, then both clients should enter the match.

This is a playable prototype using Supabase Realtime and database events. For a serious production action game, a dedicated authoritative WebSocket game server would be a better fit.

## Features

- Canvas-rendered pixel-art survival action gameplay
- Start, pause, game over, HUD, final score, and restart flow
- Camera-following city/block map larger than the viewport
- Procedural buildings, roads, crates, cars, barrels, fences, floor cracks, grass, and shadows
- Player movement, mouse aiming, shooting, collision, health, score, and wave progression
- Mobile twin-stick movement, aiming, and auto-fire controls
- Two-player Supabase Realtime room mode with lobby, remote player sync, and host-authority shared waves
- Two enemy types:
  - Zombie: slow chaser with contact damage
  - Rival survivor: keeps range and fires back
- Pickups and active abilities:
  - Speed boost
  - Faster fire rate
  - Bigger bullets
  - Spread shot
  - Shield
  - Health pack
  - Temporary invincibility
  - Damage boost
- Ability HUD with timers
- Screen shake, hit flashes, procedural particles, floating feedback text, and Web Audio sound effects
- Responsive game container and polished pixel-style UI

## Project structure

```text
src/
  main.js
  assets/
    sprites.js
  entities/
    Bullet.js
    Enemy.js
    Entity.js
    Particle.js
    Pickup.js
    Player.js
  game/
    Camera.js
    Game.js
    World.js
    constants.js
    math.js
  styles/
    base.css
  lib/
    supabaseClient.js
  multiplayer/
    MultiplayerState.js
    NetworkEvents.js
    RealtimeManager.js
    RoomManager.js
  systems/
    Audio.js
    Collision.js
    Input.js
    UI.js
```

## Screenshots

Add screenshots here after running the game locally.

```text
docs/screenshots/start-screen.png
docs/screenshots/gameplay.png
docs/screenshots/game-over.png
```

## Notes

All sprites, environment art, UI styling, particles, and sound effects are generated in code. No paid or copyrighted external assets are used.
