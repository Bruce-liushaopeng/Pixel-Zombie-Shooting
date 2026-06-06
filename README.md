# Pixel Outbreak Survivor

A modern Vite + vanilla JavaScript browser game: a 2D pixel-style top-down survival shooter rendered with HTML Canvas.

## Run the game

```bash
npm install
npm run dev
```

Open the local URL Vite prints in your terminal.

## Controls

- `WASD` or arrow keys: move
- Mouse: aim
- Left click: shoot
- `P` or `Esc`: pause/resume

## Features

- Canvas-rendered pixel-art survival action gameplay
- Start, pause, game over, HUD, final score, and restart flow
- Camera-following city/block map larger than the viewport
- Procedural buildings, roads, crates, cars, barrels, fences, floor cracks, grass, and shadows
- Player movement, mouse aiming, shooting, collision, health, score, and wave progression
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
