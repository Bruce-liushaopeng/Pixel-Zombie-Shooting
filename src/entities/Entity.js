export class Entity {
  constructor({ x, y, r = 16, health = 1 }) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.health = health;
    this.maxHealth = health;
    this.dead = false;
    this.flash = 0;
  }

  damage(amount) {
    this.health -= amount;
    this.flash = 0.12;
    if (this.health <= 0) this.dead = true;
  }

  updateBase(dt) {
    if (this.flash > 0) this.flash -= dt;
  }
}
