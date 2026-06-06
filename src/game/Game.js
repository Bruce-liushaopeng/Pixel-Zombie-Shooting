import { Camera } from './Camera.js';
import { GAME_STATE, WORLD, ABILITIES } from './constants.js';
import { chance, distance, rand } from './math.js';
import { World } from './World.js';
import { drawBullet, drawPickup, drawPlayer, drawRival, drawZombie } from '../assets/sprites.js';
import { Bullet } from '../entities/Bullet.js';
import { Rival, Zombie } from '../entities/Enemy.js';
import { FloatingText, Particle } from '../entities/Particle.js';
import { Pickup } from '../entities/Pickup.js';
import { Player } from '../entities/Player.js';
import { AudioSystem } from '../systems/Audio.js';
import { isBlocked } from '../systems/Collision.js';
import { Input } from '../systems/Input.js';
import { UI } from '../systems/UI.js';

export class Game {
  constructor({ canvas, hud, overlay }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.input = new Input(canvas);
    this.audio = new AudioSystem();
    this.ui = new UI(hud, overlay);
    this.ui.onStart = () => this.start();
    this.ui.onRestart = () => this.start();
    this.ui.onResume = () => this.setState(GAME_STATE.PLAYING);
    this.state = GAME_STATE.START;
    this.lastTime = 0;
    this.frame = 0;
    this.reset();
  }

  boot() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.ui.renderOverlay(this.state, this);
    requestAnimationFrame((time) => this.loop(time));
  }

  resize() {
    const ratio = 16 / 9;
    const frame = this.canvas.closest('.canvas-frame');
    const frameWidth = frame ? frame.clientWidth - 20 : window.innerWidth - 32;
    const width = Math.max(280, Math.min(frameWidth, 1120));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${width / ratio}px`;
  }

  reset() {
    this.world = new World();
    this.camera = new Camera(this.canvas, this.world);
    this.player = new Player(WORLD.width / 2, WORLD.height / 2);
    this.frame = 0;
    this.enemies = [];
    this.bullets = [];
    this.pickups = [this.createSafePickup('health')];
    this.particles = [];
    this.floaters = [];
    this.score = 0;
    this.wave = 0;
    this.spawnQueue = 0;
    this.spawnTimer = 0;
    this.nextWave();
  }

  start() {
    this.audio.resume();
    this.reset();
    this.setState(GAME_STATE.PLAYING);
  }

  setState(state) {
    this.state = state;
    this.ui.renderOverlay(state, this);
  }

  loop(time) {
    const dt = Math.min(0.033, (time - this.lastTime) / 1000 || 0);
    this.lastTime = time;
    if (this.input.pausePressed && this.state !== GAME_STATE.START && this.state !== GAME_STATE.GAME_OVER) {
      this.setState(this.state === GAME_STATE.PLAYING ? GAME_STATE.PAUSED : GAME_STATE.PLAYING);
    }
    if (this.state === GAME_STATE.PLAYING) this.update(dt);
    this.draw();
    this.ui.renderHud(this);
    this.input.consumeFrameFlags();
    requestAnimationFrame((next) => this.loop(next));
  }

  update(dt) {
    this.frame += 1;
    if (import.meta.env?.DEV) {
      window.__pixelOutbreakDebug = {
        frame: this.frame,
        state: this.state,
        player: { x: Math.round(this.player.x), y: Math.round(this.player.y), health: Math.ceil(this.player.health) },
        enemies: this.enemies.length,
        bullets: this.bullets.length,
        pickups: this.pickups.length,
        wave: this.wave,
        spawnQueue: this.spawnQueue,
      };
    }

    const mouseWorld = this.camera.screenToWorld(this.input.mouse);
    this.player.update(dt, this.input, mouseWorld, this.world);
    this.camera.follow(this.player, dt);

    if ((this.input.mouse.down || this.input.mouse.pressed) && this.player.canShoot()) {
      this.firePlayer(mouseWorld);
    }

    this.spawnTimer -= dt;
    if (this.spawnQueue > 0 && this.spawnTimer <= 0) {
      this.spawnEnemy();
      this.spawnQueue -= 1;
      this.spawnTimer = Math.max(0.18, 0.72 - this.wave * 0.035);
    }
    if (this.spawnQueue <= 0 && this.enemies.length === 0) this.nextWave();

    this.bullets.forEach((bullet) => bullet.update(dt, this.world));
    this.enemies.forEach((enemy) => enemy.update(dt, this));
    this.pickups.forEach((pickup) => pickup.update(dt));
    this.particles.forEach((particle) => particle.update(dt));
    this.floaters.forEach((text) => text.update(dt));
    this.handleHits();
    this.cleanup();

    if (this.player.health <= 0) this.setState(GAME_STATE.GAME_OVER);
  }

  firePlayer(mouseWorld) {
    this.player.markShot();
    const specs = [this.player.bulletSpec(mouseWorld)];
    if (this.player.hasAbility('spread')) {
      const base = Math.atan2(mouseWorld.y - this.player.y, mouseWorld.x - this.player.x);
      for (const angle of [base - 0.22, base + 0.22]) {
        specs.push({
          x: this.player.x + Math.cos(angle) * 24,
          y: this.player.y + Math.sin(angle) * 24,
          vx: Math.cos(angle) * 660,
          vy: Math.sin(angle) * 660,
          r: this.player.hasAbility('big') ? 7 : 4,
          damage: this.player.hasAbility('damage') ? 22 : 13,
          friendly: true,
        });
      }
    }
    specs.forEach((spec) => this.spawnBullet(spec));
    this.camera.addShake(3.5, 0.1);
    this.audio.shoot();
  }

  spawnBullet(spec) {
    this.bullets.push(new Bullet(spec));
  }

  spawnEnemy() {
    let x;
    let y;
    const radius = 22;
    const margin = radius + 12;
    let tries = 0;

    do {
      const side = Math.floor(rand(0, 4));
      x = side === 0 ? rand(margin, WORLD.width - margin) : side === 1 ? WORLD.width - margin : side === 2 ? rand(margin, WORLD.width - margin) : margin;
      y = side === 0 ? margin : side === 1 ? rand(margin, WORLD.height - margin) : side === 2 ? WORLD.height - margin : rand(margin, WORLD.height - margin);
      tries += 1;
    } while ((distance({ x, y }, this.player) < 520 || isBlocked(x, y, radius, this.world)) && tries < 80);

    this.enemies.push(chance(0.18 + this.wave * 0.015) ? new Rival(x, y, this.wave) : new Zombie(x, y, this.wave));
  }

  nextWave() {
    this.wave += 1;
    this.spawnQueue = 5 + this.wave * 3;
    this.spawnTimer = 0.8;
    this.addFloatingText(`Wave ${this.wave}`, this.player.x, this.player.y - 60, '#ffd166');
    if (this.wave > 1) this.pickups.push(this.createSafePickup());
  }

  createSafePickup(type = null) {
    let x;
    let y;
    let tries = 0;
    do {
      x = rand(180, WORLD.width - 180);
      y = rand(180, WORLD.height - 180);
      tries += 1;
    } while ((isBlocked(x, y, 24, this.world) || distance({ x, y }, this.player) < 120) && tries < 80);
    return new Pickup(x, y, type);
  }

  handleHits() {
    for (const bullet of this.bullets) {
      if (bullet.dead) continue;
      if (bullet.friendly) {
        for (const enemy of this.enemies) {
          if (enemy.dead || distance(bullet, enemy) > bullet.r + enemy.r) continue;
          enemy.damage(bullet.damage);
          bullet.dead = true;
          this.burst(bullet.x, bullet.y, '#ffe66d', 5);
          this.addFloatingText(`-${bullet.damage}`, enemy.x, enemy.y - 20, '#fff6d1');
          if (enemy.dead) this.killEnemy(enemy);
          break;
        }
      } else if (distance(bullet, this.player) < bullet.r + this.player.r) {
        bullet.dead = true;
        if (this.player.hurt(bullet.damage)) {
          this.camera.addShake(8, 0.18);
          this.audio.hit();
          this.addFloatingText(`-${bullet.damage}`, this.player.x, this.player.y - 24, '#ef476f');
        }
      }
    }

    for (const pickup of this.pickups) {
      if (distance(pickup, this.player) > pickup.r + this.player.r) continue;
      pickup.dead = true;
      if (pickup.type === 'health') {
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 28);
        this.addFloatingText('+HP', pickup.x, pickup.y - 18, '#7bed9f');
      } else {
        this.player.addAbility(pickup.type, ABILITIES[pickup.type].duration);
        this.addFloatingText(ABILITIES[pickup.type].label, pickup.x, pickup.y - 18, ABILITIES[pickup.type].color);
      }
      this.audio.pickup();
      this.burst(pickup.x, pickup.y, pickup.color, 8);
    }
  }

  killEnemy(enemy) {
    this.score += enemy.kind === 'rival' ? 90 : 45;
    this.audio.enemyDown();
    this.burst(enemy.x, enemy.y, enemy.kind === 'rival' ? '#ef476f' : '#78a85d', 12);
    if (chance(0.18)) this.pickups.push(new Pickup(enemy.x, enemy.y));
  }

  burst(x, y, color, amount) {
    for (let i = 0; i < amount; i++) this.particles.push(new Particle(x, y, color, amount / 8));
  }

  addFloatingText(text, x, y, color) {
    this.floaters.push(new FloatingText(text, x, y, color));
  }

  cleanup() {
    this.bullets = this.bullets.filter((bullet) => !bullet.dead);
    this.enemies = this.enemies.filter((enemy) => !enemy.dead);
    this.pickups = this.pickups.filter((pickup) => !pickup.dead);
    this.particles = this.particles.filter((particle) => particle.life > 0);
    this.floaters = this.floaters.filter((text) => text.life > 0);
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.camera.apply(this.ctx);
    this.world.draw(this.ctx, this.camera);
    this.pickups.forEach((pickup) => drawPickup(this.ctx, pickup));
    this.bullets.forEach((bullet) => drawBullet(this.ctx, bullet));
    this.enemies
      .slice()
      .sort((a, b) => a.y - b.y)
      .forEach((enemy) => (enemy.kind === 'rival' ? drawRival(this.ctx, enemy) : drawZombie(this.ctx, enemy)));
    drawPlayer(this.ctx, this.player);
    this.particles.forEach((particle) => particle.draw(this.ctx));
    this.floaters.forEach((text) => text.draw(this.ctx));
    this.ctx.restore();
    this.drawVignette();
  }

  drawVignette() {
    const gradient = this.ctx.createRadialGradient(480, 270, 80, 480, 270, 560);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.42)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
