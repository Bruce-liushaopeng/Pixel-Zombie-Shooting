import { Entity } from './Entity.js';
import { resolveWorldCollisions } from '../systems/Collision.js';
import { normalize } from '../game/math.js';

export class Player extends Entity {
  constructor(x, y) {
    super({ x, y, r: 17, health: 100 });
    this.speed = 220;
    this.angle = 0;
    this.cooldown = 0;
    this.fireDelay = 0.22;
    this.abilities = new Map();
    this.hurtCooldown = 0;
  }

  update(dt, input, aimWorld, world) {
    const move = input.movementVector();
    const speed = this.hasAbility('speed') ? this.speed * 1.45 : this.speed;
    this.x += move.x * speed * dt;
    this.y += move.y * speed * dt;
    resolveWorldCollisions(this, world);

    this.angle = Math.atan2(aimWorld.y - this.y, aimWorld.x - this.x);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);
    for (const [key, value] of this.abilities.entries()) {
      const next = value - dt;
      if (next <= 0) this.abilities.delete(key);
      else this.abilities.set(key, next);
    }
    this.updateBase(dt);
  }

  canShoot() {
    return this.cooldown <= 0;
  }

  markShot() {
    this.fireDelay = this.hasAbility('rapid') ? 0.105 : 0.22;
    this.cooldown = this.fireDelay;
  }

  bulletSpec(mouseWorld) {
    const dir = normalize(mouseWorld.x - this.x, mouseWorld.y - this.y);
    return {
      x: this.x + dir.x * 24,
      y: this.y + dir.y * 24,
      vx: dir.x * 720,
      vy: dir.y * 720,
      r: this.hasAbility('big') ? 8 : 5,
      damage: this.hasAbility('damage') ? 28 : 16,
      friendly: true,
    };
  }

  hurt(amount) {
    if (this.hurtCooldown > 0 || this.hasAbility('shield') || this.hasAbility('invincible')) return false;
    this.damage(amount);
    this.hurtCooldown = 0.45;
    return true;
  }

  addAbility(key, duration) {
    this.abilities.set(key, Math.max(this.abilities.get(key) || 0, duration));
  }

  hasAbility(key) {
    return this.abilities.has(key);
  }
}
