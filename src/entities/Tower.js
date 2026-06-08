import { Entity } from './Entity.js';
import { distance } from '../game/math.js';

export const TOWER_TIERS = {
  barricade: {
    id: 'barricade',
    name: 'Guard Tower',
    price: 150,
    health: 800,
    damage: 14,
    range: 320,
    fireDelay: 0.82,
    bulletSpeed: 620,
    color: '#9ee7ff',
  },
  sentry: {
    id: 'sentry',
    name: 'Sentry Tower',
    price: 275,
    health: 1440,
    damage: 21,
    range: 430,
    fireDelay: 0.68,
    bulletSpeed: 680,
    color: '#57b8ff',
  },
  bastion: {
    id: 'bastion',
    name: 'Bastion Tower',
    price: 425,
    health: 2240,
    damage: 30,
    range: 520,
    fireDelay: 0.58,
    bulletSpeed: 740,
    color: '#b38cff',
  },
};

export function getTowerTier(tierId = 'barricade') {
  return TOWER_TIERS[tierId] || TOWER_TIERS.barricade;
}

export class Tower extends Entity {
  constructor({ x, y, tierId = 'barricade', id = crypto.randomUUID(), ownerId = null, health = null }) {
    const tier = getTowerTier(tierId);
    super({ x, y, r: 23, health: health ?? tier.health });
    this.id = id;
    this.tierId = tier.id;
    this.ownerId = ownerId;
    this.name = tier.name;
    this.maxHealth = tier.health;
    this.damage = tier.damage;
    this.range = tier.range;
    this.fireDelay = tier.fireDelay;
    this.bulletSpeed = tier.bulletSpeed;
    this.color = tier.color;
    this.cooldown = Math.random() * tier.fireDelay;
    this.angle = 0;
  }

  update(dt, game) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const target = this.targetEnemy(game.enemies);
    if (!target) {
      this.updateBase(dt);
      return;
    }
    this.angle = Math.atan2(target.y - this.y, target.x - this.x);
    if (this.cooldown <= 0) {
      this.cooldown = this.fireDelay;
      game.spawnBullet({
        x: this.x + Math.cos(this.angle) * 24,
        y: this.y + Math.sin(this.angle) * 24,
        sourceX: this.x,
        sourceY: this.y,
        vx: Math.cos(this.angle) * this.bulletSpeed,
        vy: Math.sin(this.angle) * this.bulletSpeed,
        r: 5,
        damage: this.damage,
        friendly: true,
        ownerId: this.ownerId,
        weaponType: 'tower',
        color: this.color,
        life: 1.25,
      });
    }
    this.updateBase(dt);
  }

  targetEnemy(enemies) {
    return enemies
      .filter((enemy) => !enemy.dead && distance(this, enemy) <= this.range)
      .sort((a, b) => distance(this, a) - distance(this, b))[0] || null;
  }

  serialize() {
    return {
      id: this.id,
      tierId: this.tierId,
      ownerId: this.ownerId,
      x: this.x,
      y: this.y,
      health: this.health,
      maxHealth: this.maxHealth,
      angle: this.angle,
      cooldown: this.cooldown,
    };
  }
}
