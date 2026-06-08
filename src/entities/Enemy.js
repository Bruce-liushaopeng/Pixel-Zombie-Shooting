import { Entity } from './Entity.js';
import { normalize, distance } from '../game/math.js';
import { resolveWorldCollisions } from '../systems/Collision.js';
import { getZombieType } from './ZombieTypes.js';

export class Zombie extends Entity {
  constructor(x, y, wave, typeId = 'normal', difficulty = null) {
    const type = getZombieType(typeId);
    const health = Math.round((type.health + wave * 4) * (type.boss ? 3 : 1) * (difficulty?.healthMultiplier || 1));
    super({ x, y, r: type.radius, health });
    this.typeId = type.id;
    this.label = type.label;
    this.color = type.color;
    this.behavior = type.behavior || 'basic';
    this.isBoss = Boolean(type.boss);
    this.attackDamage = Math.round(type.damage * (difficulty?.damageMultiplier || 1));
    this.reward = Math.round(type.reward * (difficulty?.scoreMultiplier || 1));
    this.moneyReward = type.money;
    this.speed = (82 + wave * 3) * type.speed * (difficulty?.speedMultiplier || 1);
    this.kind = 'zombie';
    this.warnTimer = 0;
    this.movePhase = Math.random() * Math.PI * 2;
    this.chargeTimer = 0.6 + Math.random() * 1.4;
    this.path = [];
    this.pathTimer = Math.random() * 0.5;
    this.pathRecheck = 0.35 + Math.random() * 0.35;
  }

  update(dt, game) {
    const target = game.nearestLivingPlayer(this);
    if (!target) return;
    let dir = this.pathDirection(dt, game, target);
    let speed = this.speed;
    this.angle = Math.atan2(target.y - this.y, target.x - this.x);
    this.movePhase += dt * 5;
    if (this.behavior === 'angry' && this.health < this.maxHealth * 0.55) speed *= 1.65;
    if (this.behavior === 'dodger') {
      const side = Math.sin(this.movePhase) * 0.55;
      dir = normalize(dir.x - dir.y * side, dir.y + dir.x * side);
    }
    if (this.behavior === 'charger') {
      this.chargeTimer -= dt;
      if (this.chargeTimer < 0.28) speed *= 2.4;
      if (this.chargeTimer <= 0) this.chargeTimer = 1.4 + Math.random() * 1.4;
    }
    if (this.behavior === 'swarm') {
      speed *= 1 + Math.sin(this.movePhase) * 0.18;
    }
    this.x += dir.x * speed * dt;
    this.y += dir.y * speed * dt;
    resolveWorldCollisions(this, game.world);
    if (this.typeId === 'exploder' && distance(this, target) < this.r + target.r + 24) {
      this.warnTimer += dt;
      if (this.warnTimer > 0.55) {
        if (target.isLocal && distance(this, target) < this.r + target.r + 56 && game.player.hurt(this.attackDamage)) {
          game.camera.addShake(10, 0.18);
          game.audio.hit();
          game.addFloatingText(`-${this.attackDamage}`, game.player.x, game.player.y - 25, '#ef476f');
        } else if (target.isTower && target.towerRef && distance(this, target) < this.r + target.r + 56) {
          game.damageTower(target.towerRef, this.attackDamage);
          game.addFloatingText(`-${this.attackDamage}`, target.towerRef.x, target.towerRef.y - 34, '#9ee7ff');
        }
        game.burst(this.x, this.y, '#ff8c42', 16);
        this.dead = true;
      }
    } else if (target.isLocal && distance(this, target) < this.r + target.r && game.player.hurt(this.attackDamage)) {
      game.camera.addShake(9, 0.22);
      game.audio.hit();
      game.addFloatingText(`-${this.attackDamage}`, game.player.x, game.player.y - 25, '#ef476f');
    } else if (target.isTower && target.towerRef && distance(this, target) < this.r + target.r) {
      game.damageTower(target.towerRef, this.attackDamage * dt * 1.7);
    }
    this.updateBase(dt);
  }

  pathDirection(dt, game, target) {
    const grid = game.world?.pathfindingGrid;
    if (!grid || grid.hasLineOfSight(this, target)) {
      this.path = [];
      return normalize(target.x - this.x, target.y - this.y);
    }

    this.pathTimer -= dt;
    if (this.pathTimer <= 0 || !this.path.length || distance(this.path[this.path.length - 1], target) > 120) {
      const far = distance(this, target) > 850;
      this.pathTimer = (far ? 0.65 : this.pathRecheck) + Math.random() * 0.18;
      this.path = grid.findPath(this, target);
    }

    while (this.path.length && distance(this, this.path[0]) < Math.max(28, this.r + 10)) this.path.shift();
    const waypoint = this.path[0] || target;
    return normalize(waypoint.x - this.x, waypoint.y - this.y);
  }
}

export class Rival extends Entity {
  constructor(x, y, wave, typeId = 'spitter', difficulty = null) {
    const type = getZombieType(typeId === 'rival' ? 'spitter' : typeId);
    const rangedHealthMultiplier = type.boss ? 1 : 0.62;
    const health = Math.round((type.health + wave * 5) * (type.boss ? 3 : 1) * rangedHealthMultiplier * (difficulty?.healthMultiplier || 1));
    super({ x, y, r: type.radius, health });
    this.typeId = type.id;
    this.label = type.label;
    this.color = type.color;
    this.behavior = type.behavior || 'ranged';
    this.isBoss = Boolean(type.boss);
    this.attackDamage = Math.round(type.damage * (difficulty?.damageMultiplier || 1));
    this.reward = Math.round(type.reward * (difficulty?.scoreMultiplier || 1));
    this.moneyReward = type.money;
    this.speed = 120 * type.speed * (difficulty?.speedMultiplier || 1);
    this.kind = 'rival';
    this.shootTimer = 1 + Math.random();
    this.summonTimer = 5 + Math.random() * 3;
    this.angle = 0;
    this.path = [];
    this.pathTimer = Math.random() * 0.45;
  }

  update(dt, game) {
    const target = game.nearestLivingPlayer(this);
    if (!target) return;
    const dist = distance(this, target);
    const canSeeTarget = this.hasLineOfSight(game, target);
    const dir = this.rangedDirection(dt, game, target, dist, canSeeTarget);
    const desired = canSeeTarget ? (dist < 250 ? -1 : dist > 380 ? 1 : 0) : 1;
    this.x += dir.x * this.speed * desired * dt;
    this.y += dir.y * this.speed * desired * dt;
    resolveWorldCollisions(this, game.world);
    const canShootTarget = this.hasLineOfSight(game, target);
    const aimDir = normalize(target.x - this.x, target.y - this.y);
    this.angle = Math.atan2(aimDir.y, aimDir.x);
    this.shootTimer -= dt;
    if (this.shootTimer <= 0 && dist < 680 && canShootTarget) {
      this.shootTimer = (this.isBoss ? 0.9 : 1.45) + Math.random() * 0.7;
      game.spawnBullet({
        x: this.x + aimDir.x * 24,
        y: this.y + aimDir.y * 24,
        vx: aimDir.x * 440,
        vy: aimDir.y * 440,
        r: 5,
        damage: this.attackDamage,
        friendly: false,
        life: 1.8,
        color: this.color,
      });
    }
    if (this.behavior === 'summoner') {
      this.summonTimer -= dt;
      if (this.summonTimer <= 0) {
        this.summonTimer = 5.5;
        game.spawnEnemyNear(this.x, this.y, 'swarm');
        game.spawnEnemyNear(this.x, this.y, 'weak');
      }
    }
    this.updateBase(dt);
  }

  hasLineOfSight(game, target) {
    const grid = game.world?.pathfindingGrid;
    return !grid || grid.hasLineOfSight(this, target);
  }

  rangedDirection(dt, game, target, dist, canSeeTarget = this.hasLineOfSight(game, target)) {
    const desired = dist < 250 ? -1 : dist > 380 ? 1 : 0;
    if (canSeeTarget && desired <= 0) return normalize(target.x - this.x, target.y - this.y);
    const grid = game.world?.pathfindingGrid;
    if (!grid || canSeeTarget) return normalize(target.x - this.x, target.y - this.y);
    this.pathTimer -= dt;
    if (this.pathTimer <= 0 || !this.path.length) {
      this.pathTimer = 0.5 + Math.random() * 0.25;
      this.path = grid.findPath(this, target, 650);
    }
    while (this.path.length && distance(this, this.path[0]) < Math.max(28, this.r + 10)) this.path.shift();
    const waypoint = this.path[0] || target;
    return normalize(waypoint.x - this.x, waypoint.y - this.y);
  }
}
