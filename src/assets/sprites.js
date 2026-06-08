import { COLORS } from '../game/constants.js';

export function drawPlayer(ctx, entity, options = {}) {
  const shirt = options.shirt || '#4cc9a7';
  const glow = options.glow || null;
  ctx.save();
  if (options.downed) ctx.globalAlpha = 0.48;
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
  const bob = Math.sin(enemy.movePhase || 0) * Math.min(3, enemy.r * 0.12);
  const isSmall = enemy.r <= 13;
  const isTank = enemy.r >= 20 || enemy.behavior === 'tank';
  const isQuick = ['charger', 'dodger', 'swarm'].includes(enemy.behavior) || ['fast', 'runner'].includes(enemy.typeId);
  ctx.save();
  ctx.translate(enemy.x, enemy.y + bob);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(-enemy.r + 2, enemy.r - 3 - bob, enemy.r * 2 - 4, 6);
  ctx.fillStyle = enemy.flash > 0 ? '#fff8dc' : COLORS.outline;
  ctx.fillRect(-enemy.r + (isSmall ? 5 : 3), -enemy.r, enemy.r * 2 - (isSmall ? 10 : 6), enemy.r * 2);
  ctx.fillStyle = enemy.flash > 0 ? '#ffe66d' : enemy.color || '#78a85d';
  ctx.fillRect(-enemy.r + (isSmall ? 8 : 7), -enemy.r + 2, enemy.r * 2 - (isSmall ? 16 : 14), isTank ? 16 : 13);
  ctx.fillStyle = isTank ? '#3d4a32' : '#546a38';
  ctx.fillRect(-enemy.r + 5, isSmall ? 2 : 0, enemy.r * 2 - 10, enemy.r + (isTank ? 6 : 2));
  ctx.fillStyle = '#2b3828';
  ctx.fillRect(-6, -9, 3, 3);
  ctx.fillRect(4, -9, 3, 3);
  ctx.fillStyle = '#8a3038';
  ctx.fillRect(-4, -2, 9, 3);
  if (isTank) {
    ctx.fillStyle = '#c8d1d8';
    ctx.fillRect(-enemy.r + 8, -enemy.r + 8, 5, enemy.r + 4);
    ctx.fillRect(enemy.r - 13, -enemy.r + 8, 5, enemy.r + 4);
  }
  if (isQuick) {
    ctx.fillStyle = '#fff6d1';
    ctx.fillRect(-enemy.r + 2, enemy.r - 7, 5, 8);
    ctx.fillRect(enemy.r - 7, enemy.r - 9, 5, 8);
  }
  if (enemy.isBoss) {
    ctx.fillStyle = '#fff6d1';
    ctx.fillRect(-enemy.r + 7, -enemy.r - 7, 8, 8);
    ctx.fillRect(enemy.r - 15, -enemy.r - 7, 8, 8);
  }
  if (enemy.typeId === 'exploder') {
    ctx.fillStyle = enemy.warnTimer > 0 ? '#ffd166' : '#ff8c42';
    ctx.fillRect(-4, 7, 8, 8);
  }
  ctx.restore();
  drawEnemyLabel(ctx, enemy);
}

export function drawRival(ctx, enemy) {
  const isBoss = enemy.isBoss;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.angle);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(-enemy.r + 3, enemy.r - 3, enemy.r * 2 - 6, 6);
  ctx.fillStyle = enemy.flash > 0 ? '#fff8dc' : COLORS.outline;
  ctx.fillRect(-enemy.r + 5, -enemy.r + 3, enemy.r * 2 - 10, enemy.r * 2 - 4);
  ctx.fillStyle = '#d99b6c';
  ctx.fillRect(-8, -enemy.r + 3, 16, 10);
  ctx.fillStyle = enemy.color || '#ef476f';
  ctx.fillRect(-enemy.r + 8, -3, enemy.r * 2 - 16, enemy.r + 3);
  ctx.fillStyle = '#111820';
  ctx.fillRect(enemy.r - 9, -4, isBoss ? 24 : 18, 6);
  if (enemy.behavior === 'summoner') {
    ctx.fillStyle = '#b38cff';
    ctx.fillRect(-4, enemy.r - 11, 8, 8);
  }
  if (isBoss) {
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-enemy.r + 7, -enemy.r - 5, 7, 7);
    ctx.fillRect(enemy.r - 14, -enemy.r - 5, 7, 7);
  }
  ctx.restore();
  drawEnemyLabel(ctx, enemy);
}

function drawEnemyLabel(ctx, enemy) {
  if (!enemy.label || enemy.typeId === 'normal') return;
  ctx.save();
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = 3;
  ctx.strokeText(enemy.label, enemy.x, enemy.y - enemy.r - 5);
  ctx.fillStyle = enemy.color || '#fff6d1';
  ctx.fillText(enemy.label, enemy.x, enemy.y - enemy.r - 5);
  ctx.restore();
}

export function drawBullet(ctx, bullet) {
  ctx.save();
  ctx.translate(bullet.x, bullet.y);
  ctx.fillStyle = bullet.color || (bullet.friendly ? COLORS.yellow : COLORS.red);
  ctx.fillRect(-bullet.r, -bullet.r, bullet.r * 2, bullet.r * 2);
  if (bullet.area) {
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.45)';
    ctx.strokeRect(-bullet.r - 3, -bullet.r - 3, bullet.r * 2 + 6, bullet.r * 2 + 6);
  }
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

export function drawTower(ctx, tower) {
  const pct = Math.max(0, Math.min(1, tower.health / tower.maxHealth));
  ctx.save();
  ctx.translate(tower.x, tower.y);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.fillRect(-24, 19, 48, 8);
  ctx.fillStyle = COLORS.outline;
  ctx.fillRect(-24, -24, 48, 48);
  ctx.fillStyle = tower.flash > 0 ? '#fff8dc' : '#2f3c45';
  ctx.fillRect(-19, -19, 38, 38);
  ctx.fillStyle = tower.color || '#9ee7ff';
  ctx.fillRect(-12, -12, 24, 24);
  ctx.rotate(tower.angle || 0);
  ctx.fillStyle = '#101820';
  ctx.fillRect(2, -5, 26, 10);
  ctx.fillStyle = '#fff6d1';
  ctx.fillRect(21, -2, 7, 4);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#101820';
  ctx.fillRect(tower.x - 24, tower.y - 37, 48, 6);
  ctx.fillStyle = pct > 0.45 ? '#9ee7ff' : '#ef476f';
  ctx.fillRect(tower.x - 24, tower.y - 37, 48 * pct, 6);
  ctx.strokeStyle = COLORS.outline;
  ctx.strokeRect(tower.x - 24, tower.y - 37, 48, 6);
  ctx.restore();
}
