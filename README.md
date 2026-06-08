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
- `B`: open the weapon shop
- `Q` or Space: use Special when charged
- `M`: mute/unmute generated audio

## Mobile controls

Pixel Outbreak Survivor supports touch twin-stick controls on phones, tablets, and small touch screens. Mobile play is intended for horizontal/landscape orientation.

- Left virtual joystick: move the player
- Right virtual joystick: aim
- Hold or move the right virtual joystick: shoot continuously at the current fire rate
- Release the right virtual joystick: stop shooting while keeping the last aim direction
- Both joysticks support multi-touch, so you can move and shoot at the same time

## Game modes and difficulty

Before starting, choose Easy, Medium, or Hard. Difficulty changes zombie counts, speed, health, damage, wave scaling, pickup drops, and score rewards.

- Single Player: classic survival against zombie waves
- Multiplayer Co-op: two players fight zombies together, with friendly fire disabled
- Multiplayer PvP: two players can damage each other while zombies remain an environmental threat

Players also level up from score. Each level restores exactly 10 HP, capped at max HP, and adds +2 bullet damage per level. Leveling does not increase fire rate.

## Shop and weapons

Press `B` or click/tap Shop during a run. In single-player the shop pauses the game; in multiplayer the game continues while shopping. The shop has tabs for weapons and paid HP recovery.

Score and money are separate. Score is your final performance value and is never spent; money is the shop currency. Weapons include:

- Starter Pistol: unlimited ammo
- SMG: fast fire rate, limited ammo
- Shotgun: spread pellets, limited ammo
- Rifle: accurate high-damage shots, limited ammo
- Plasma Gun: powerful glowing shots, limited ammo
- Rocket Launcher: slow arcade area-damage shots, limited ammo

When a limited-ammo weapon runs dry, the player automatically switches back to the Starter Pistol.

## Progression, themes, and special

Waves unlock new enemy variants and map themes: Abandoned City, Toxic Zone, Burning Factory, Frozen Outpost, and Mutant Lab. Theme changes alter the map palette, props, zombie pool, and generated chiptune loop. Boss waves appear every 5 waves and display a boss health bar with intensified music.

The special ability charges only from combat hits and kill bonuses. Press `Q`, Space, or tap the circular Special button on mobile when it reaches READY to launch an automatic rocket toward the best nearby enemy group. The rocket deals area damage, scales modestly with player level, and resets charge to 0%.

## Revive

In Multiplayer Co-op, one downed player does not immediately end the run. If the teammate is still alive, the downed player revives after a countdown with 50% HP and the Starter Pistol. Score, money, and level are kept, but purchased weapon ammo is lost. If both players are down at the same time, the co-op run ends.

## Multiplayer

The game includes a prototype two-player online room mode using Supabase Realtime.

- Main menu: choose Single Player or Multiplayer
- Multiplayer: choose Co-op or PvP, enter a player name and room code, then Join / Create Room
- First player creates the room and becomes host
- Second connected player joins slot 2 and starts the match automatically
- Host owns shared wave, zombie, and pickup sync
- Both players send throttled position updates and immediate shooting events
- Remote players are interpolated and drawn with different colors and name labels
- Shot events include weapon type so different bullet styles sync across clients
- PvP hit and player-died events are sent through `room_events`

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
- Easy, Medium, and Hard difficulty selection
- Co-op and PvP multiplayer modes
- Weapon shop with ammo-limited purchased weapons
- Separate score and money economy, so shop spending does not reduce final score
- Score-based level progression with level-up healing and weapon scaling
- Combat-charged special rocket ability
- Co-op downed/revive flow
- 30 zombie and boss variants with theme and wave availability
- Wave-based map themes with generated chiptune music and boss music intensity
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
