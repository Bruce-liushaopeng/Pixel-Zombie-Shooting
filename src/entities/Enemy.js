import { Entity } from './Entity.js';
import { normalize, distance } from '../game/math.js';
import { resolveWorldCollisions } from '../systems/Collision.js';

export class Zombie extends Entity {
  constructor(x, y, wave) {
    super({ x, y, r: 16, health: 34 + wave * 4 });
    this.speed = 82 + wave * 3;
    this.kind = 'zombie';
  }

  update(dt, game) {
    const target = game.nearestLivingPlayer(this);
    if (!target) return;
    const dir = normalize(target.x - this.x, target.y - this.y);
    this.x += dir.x * this.speed * dt;
    this.y += dir.y * this.speed * dt;
    resolveWorldCollisions(this, game.world);
    if (target.isLocal && distance(this, target) < this.r + target.r && game.player.hurt(13)) {
      game.camera.addShake(9, 0.22);
      game.audio.hit();
      game.addFloatingText('-13', game.player.x, game.player.y - 25, '#ef476f');
    }
    this.updateBase(dt);
  }
}

export class Rival extends Entity {
  constructor(x, y, wave) {
    super({ x, y, r: 17, health: 46 + wave * 5 });
    this.speed = 120;
    this.kind = 'rival';
    this.shootTimer = 1 + Math.random();
    this.angle = 0;
  }

  update(dt, game) {
    const target = game.nearestLivingPlayer(this);
    if (!target) return;
    const dist = distance(this, target);
    const dir = normalize(target.x - this.x, target.y - this.y);
    const desired = dist < 250 ? -1 : dist > 380 ? 1 : 0;
    this.x += dir.x * this.speed * desired * dt;
    this.y += dir.y * this.speed * desired * dt;
    resolveWorldCollisions(this, game.world);
    this.angle = Math.atan2(target.y - this.y, target.x - this.x);
    this.shootTimer -= dt;
    if (this.shootTimer <= 0 && dist < 680) {
      this.shootTimer = 1.45 + Math.random() * 0.7;
      game.spawnBullet({
        x: this.x + dir.x * 24,
        y: this.y + dir.y * 24,
        vx: dir.x * 440,
        vy: dir.y * 440,
        r: 5,
        damage: 9,
        friendly: false,
        life: 1.8,
      });
    }
    this.updateBase(dt);
  }
}
