import { circleRectCollision } from '../game/math.js';

export class Bullet {
  constructor(spec) {
    Object.assign(this, spec);
    this.life = spec.life ?? 1.1;
    this.dead = false;
  }

  update(dt, world) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0 || this.x < 0 || this.y < 0 || this.x > world.width || this.y > world.height) {
      this.dead = true;
    }
    if (world.obstacles.some((obstacle) => circleRectCollision(this, obstacle))) this.dead = true;
  }
}
