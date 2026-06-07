import { COLORS } from '../game/constants.js';

export function drawPlayer(ctx, entity, options = {}) {
  const shirt = options.shirt || '#4cc9a7';
  const glow = options.glow || null;
  ctx.save();
  ctx.translate(entity.x, entity.y);
  ctx.rotate(entity.angle);
  if (glow) {
    ctx.fillStyle = glow;
    ctx.globalAlpha = 0.32;
    ctx.fillRect(-20, -20, 40, 44);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = COLORS.outline;
  ctx.fillRect(-13, -12, 28, 24);
  ctx.fillStyle = '#f5c08a';
  ctx.fillRect(-8, -14, 16, 11);
  ctx.fillStyle = shirt;
  ctx.fillRect(-12, -4, 24, 18);
  ctx.fillStyle = '#26313a';
  ctx.fillRect(5, -5, 22, 7);
  ctx.fillStyle = '#d7eef7';
  ctx.fillRect(18, -3, 7, 3);
  ctx.fillStyle = '#1d2f22';
  ctx.fillRect(-12, 8, 9, 12);
  ctx.fillRect(4, 8, 9, 12);
  ctx.restore();

  if (options.name) {
    ctx.save();
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.outline;
    ctx.strokeText(options.name, entity.x, entity.y - 28);
    ctx.fillStyle = options.labelColor || '#fff6d1';
    ctx.fillText(options.name, entity.x, entity.y - 28);
    ctx.restore();
  }
}

export function drawZombie(ctx, enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.fillStyle = enemy.flash > 0 ? '#fff8dc' : COLORS.outline;
  ctx.fillRect(-13, -15, 26, 30);
  ctx.fillStyle = enemy.flash > 0 ? '#ffe66d' : '#78a85d';
  ctx.fillRect(-9, -13, 18, 13);
  ctx.fillStyle = '#546a38';
  ctx.fillRect(-11, 0, 22, 18);
  ctx.fillStyle = '#2b3828';
  ctx.fillRect(-6, -9, 3, 3);
  ctx.fillRect(4, -9, 3, 3);
  ctx.fillStyle = '#8a3038';
  ctx.fillRect(-4, -2, 9, 3);
  ctx.restore();
}

export function drawRival(ctx, enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.angle);
  ctx.fillStyle = enemy.flash > 0 ? '#fff8dc' : COLORS.outline;
  ctx.fillRect(-13, -13, 26, 26);
  ctx.fillStyle = '#d99b6c';
  ctx.fillRect(-8, -13, 16, 10);
  ctx.fillStyle = '#ef476f';
  ctx.fillRect(-11, -3, 22, 17);
  ctx.fillStyle = '#111820';
  ctx.fillRect(7, -4, 18, 6);
  ctx.restore();
}

export function drawBullet(ctx, bullet) {
  ctx.save();
  ctx.translate(bullet.x, bullet.y);
  ctx.fillStyle = bullet.friendly ? COLORS.yellow : COLORS.red;
  ctx.fillRect(-bullet.r, -bullet.r, bullet.r * 2, bullet.r * 2);
  ctx.restore();
}

export function drawPickup(ctx, pickup) {
  ctx.save();
  ctx.translate(pickup.x, pickup.y);
  ctx.rotate(pickup.pulse);
  ctx.fillStyle = '#101417';
  ctx.fillRect(-11, -11, 22, 22);
  ctx.fillStyle = pickup.color;
  ctx.fillRect(-8, -8, 16, 16);
  ctx.fillStyle = '#fff6d1';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pickup.icon, 0, 1);
  ctx.restore();
}
