import { Entity } from './Entity.js';
import { normalize, distance } from '../game/math.js';
import { resolveWorldCollisions } from '../systems/Collision.js';
import { getZombieType } from './ZombieTypes.js';

export class Zombie extends Entity {
  constructor(x, y, wave, typeId = 'normal', difficulty = null) {
    const type = getZombieType(typeId);
    const health = Math.round((type.health + wave * 4) * (difficulty?.healthMultiplier || 1));
    super({ x, y, r: type.radius, health });
    this.typeId = type.id;
    this.label = type.label;
    this.color = type.color;
    this.attackDamage = Math.round(type.damage * (difficulty?.damageMultiplier || 1));
    this.reward = Math.round(type.reward * (difficulty?.scoreMultiplier || 1));
    this.moneyReward = type.money;
    this.speed = (82 + wave * 3) * type.speed * (difficulty?.speedMultiplier || 1);
    this.kind = 'zombie';
    this.warnTimer = 0;
  }

  update(dt, game) {
    const target = game.nearestLivingPlayer(this);
    if (!target) return;
    const dir = normalize(target.x - this.x, target.y - this.y);
    this.x += dir.x * this.speed * dt;
    this.y += dir.y * this.speed * dt;
    resolveWorldCollisions(this, game.world);
    if (this.typeId === 'exploder' && distance(this, target) < this.r + target.r + 24) {
      this.warnTimer += dt;
      if (this.warnTimer > 0.55) {
        if (target.isLocal && distance(this, target) < this.r + target.r + 56 && game.player.hurt(this.attackDamage)) {
          game.camera.addShake(10, 0.18);
          game.audio.hit();
          game.addFloatingText(`-${this.attackDamage}`, game.player.x, game.player.y - 25, '#ef476f');
        }
        game.burst(this.x, this.y, '#ff8c42', 16);
        this.dead = true;
      }
    } else if (target.isLocal && distance(this, target) < this.r + target.r && game.player.hurt(this.attackDamage)) {
      game.camera.addShake(9, 0.22);
      game.audio.hit();
      game.addFloatingText(`-${this.attackDamage}`, game.player.x, game.player.y - 25, '#ef476f');
    }
    this.updateBase(dt);
  }
}

export class Rival extends Entity {
  constructor(x, y, wave, typeId = 'spitter', difficulty = null) {
    const type = getZombieType(typeId === 'rival' ? 'spitter' : typeId);
    const rangedHealthMultiplier = type.id === 'spitter' ? 0.62 : 1;
    const health = Math.round((type.health + wave * 5) * rangedHealthMultiplier * (difficulty?.healthMultiplier || 1));
    super({ x, y, r: type.radius, health });
    this.typeId = type.id;
    this.label = type.label;
    this.color = type.color;
    this.attackDamage = Math.round(type.damage * (difficulty?.damageMultiplier || 1));
    this.reward = Math.round(type.reward * (difficulty?.scoreMultiplier || 1));
    this.moneyReward = type.money;
    this.speed = 120 * type.speed * (difficulty?.speedMultiplier || 1);
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
        damage: this.attackDamage,
        friendly: false,
        life: 1.8,
        color: this.color,
      });
    }
    this.updateBase(dt);
  }
}
