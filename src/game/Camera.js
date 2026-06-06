import { clamp } from './math.js';

export class Camera {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.world = world;
    this.x = 0;
    this.y = 0;
    this.shake = 0;
    this.shakeTime = 0;
  }

  follow(target, dt) {
    const desiredX = target.x - this.canvas.width / 2;
    const desiredY = target.y - this.canvas.height / 2;
    this.x += (desiredX - this.x) * Math.min(1, dt * 8);
    this.y += (desiredY - this.y) * Math.min(1, dt * 8);
    this.x = clamp(this.x, 0, this.world.width - this.canvas.width);
    this.y = clamp(this.y, 0, this.world.height - this.canvas.height);

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      this.shake *= 0.88;
    } else {
      this.shake = 0;
    }
  }

  addShake(amount, time = 0.16) {
    this.shake = Math.max(this.shake, amount);
    this.shakeTime = Math.max(this.shakeTime, time);
  }

  apply(ctx) {
    const jitterX = (Math.random() - 0.5) * this.shake;
    const jitterY = (Math.random() - 0.5) * this.shake;
    ctx.translate(Math.round(-this.x + jitterX), Math.round(-this.y + jitterY));
  }

  screenToWorld(point) {
    return { x: point.x + this.x, y: point.y + this.y };
  }
}
