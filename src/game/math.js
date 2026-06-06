export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const rand = (min, max) => min + Math.random() * (max - min);
export const chance = (value) => Math.random() < value;

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalize(x, y) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function circleRectCollision(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  return Math.hypot(circle.x - closestX, circle.y - closestY) < circle.r;
}
