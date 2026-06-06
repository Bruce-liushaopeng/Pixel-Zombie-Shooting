import { rand } from '../game/math.js';

export class Particle {
  constructor(x, y, color, count = 1) {
    this.x = x;
    this.y = y;
    this.vx = rand(-120, 120) * count;
    this.vy = rand(-120, 120) * count;
    this.life = rand(0.25, 0.65);
    this.maxLife = this.life;
    this.color = color;
    this.size = rand(2, 7);
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.94;
    this.vy *= 0.94;
    this.life -= dt;
  }

  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

export class FloatingText {
  constructor(text, x, y, color = '#fff6d1') {
    this.text = text;
    this.x = x;
    this.y = y;
    this.vy = -34;
    this.life = 0.8;
    this.color = color;
  }

  update(dt) {
    this.y += this.vy * dt;
    this.life -= dt;
  }

  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life / 0.8);
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#101417';
    ctx.fillText(this.text, this.x + 2, this.y + 2);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
  }
}
