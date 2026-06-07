# Pixel Outbreak Survivor

A modern Vite + vanilla JavaScript browser game: a 2D pixel-style top-down survival shooter rendered with HTML Canvas.

## Run the game

```bash
npm install
npm run dev
```

Open the local URL Vite prints in your terminal.

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

## Features

- Canvas-rendered pixel-art survival action gameplay
- Start, pause, game over, HUD, final score, and restart flow
- Camera-following city/block map larger than the viewport
- Procedural buildings, roads, crates, cars, barrels, fences, floor cracks, grass, and shadows
- Player movement, mouse aiming, shooting, collision, health, score, and wave progression
- Mobile twin-stick movement, aiming, and auto-fire controls
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
