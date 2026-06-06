import { circleRectCollision, clamp } from '../game/math.js';

export function resolveWorldCollisions(entity, world) {
  entity.x = clamp(entity.x, entity.r, world.width - entity.r);
  entity.y = clamp(entity.y, entity.r, world.height - entity.r);

  for (const obstacle of world.obstacles) {
    if (!circleRectCollision(entity, obstacle)) continue;
    const cx = clamp(entity.x, obstacle.x, obstacle.x + obstacle.w);
    const cy = clamp(entity.y, obstacle.y, obstacle.y + obstacle.h);
    const dx = entity.x - cx;
    const dy = entity.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const push = entity.r - dist + 0.5;
    entity.x += (dx / dist) * push;
    entity.y += (dy / dist) * push;
  }
}

export function isBlocked(x, y, radius, world) {
  if (x < radius || y < radius || x > world.width - radius || y > world.height - radius) return true;
  return world.obstacles.some((obstacle) => circleRectCollision({ x, y, r: radius }, obstacle));
}
