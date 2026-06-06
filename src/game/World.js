import { COLORS, WORLD } from './constants.js';
import { rand } from './math.js';

export class World {
  constructor() {
    this.width = WORLD.width;
    this.height = WORLD.height;
    this.obstacles = [];
    this.details = [];
    this.build();
  }

  build() {
    const buildings = [
      [120, 100, 320, 210], [650, 110, 270, 190], [1120, 80, 360, 240], [1770, 130, 280, 210],
      [180, 610, 250, 260], [760, 560, 300, 230], [1390, 610, 310, 260], [1930, 560, 260, 300],
      [120, 1130, 360, 230], [920, 1110, 330, 250], [1580, 1110, 300, 230],
    ];
    this.obstacles = buildings.map(([x, y, w, h]) => ({ x, y, w, h, type: 'building' }));
    const props = [
      [560, 420, 80, 34, 'crate'], [470, 990, 120, 30, 'fence'], [1290, 420, 42, 90, 'barrel'],
      [1810, 1020, 140, 36, 'car'], [2080, 430, 92, 34, 'crate'], [680, 1360, 38, 110, 'fence'],
      [1320, 955, 120, 34, 'car'], [2240, 1210, 36, 92, 'barrel'],
    ];
    this.obstacles.push(...props.map(([x, y, w, h, type]) => ({ x, y, w, h, type })));

    for (let i = 0; i < 160; i++) {
      this.details.push({
        x: rand(20, this.width - 20),
        y: rand(20, this.height - 20),
        kind: Math.random() > 0.5 ? 'crack' : 'grass',
      });
    }
  }

  draw(ctx, camera) {
    const view = {
      x: Math.max(0, camera.x - 80),
      y: Math.max(0, camera.y - 80),
      w: camera.canvas.width + 160,
      h: camera.canvas.height + 160,
    };

    ctx.fillStyle = COLORS.grassDark;
    ctx.fillRect(view.x, view.y, view.w, view.h);

    this.drawRoads(ctx, view);
    this.drawDetails(ctx, view);

    for (const obstacle of this.obstacles) {
      if (!this.isVisible(obstacle, view)) continue;
      this.drawObstacle(ctx, obstacle);
    }
  }

  isVisible(rect, view) {
    return rect.x + rect.w >= view.x && rect.x <= view.x + view.w && rect.y + rect.h >= view.y && rect.y <= view.y + view.h;
  }

  drawRoads(ctx, view) {
    const horizontalRoads = [
      { x: 0, y: 370, w: this.width, h: 160 },
      { x: 0, y: 930, w: this.width, h: 150 },
    ];
    const verticalRoads = [
      { x: 520, y: 0, w: 170, h: this.height },
      { x: 1260, y: 0, w: 170, h: this.height },
      { x: 2190, y: 0, w: 130, h: this.height },
    ];

    ctx.fillStyle = COLORS.asphalt;
    for (const road of [...horizontalRoads, ...verticalRoads]) {
      if (this.isVisible(road, view)) ctx.fillRect(road.x, road.y, road.w, road.h);
    }

    ctx.fillStyle = COLORS.curb;
    for (const y of [370, 530, 930, 1080]) {
      const curb = { x: 0, y, w: this.width, h: 8 };
      if (this.isVisible(curb, view)) ctx.fillRect(curb.x, curb.y, curb.w, curb.h);
    }
    for (const x of [520, 690, 1260, 1430, 2190]) {
      const curb = { x, y: 0, w: 8, h: this.height };
      if (this.isVisible(curb, view)) ctx.fillRect(curb.x, curb.y, curb.w, curb.h);
    }

    ctx.fillStyle = '#e7d98a';
    for (let x = Math.max(24, Math.floor(view.x / 96) * 96); x < view.x + view.w; x += 96) {
      ctx.fillRect(x, 446, 42, 5);
      ctx.fillRect(x, 1002, 42, 5);
    }
  }

  drawDetails(ctx, view) {
    for (const detail of this.details) {
      if (detail.x < view.x || detail.x > view.x + view.w || detail.y < view.y || detail.y > view.y + view.h) continue;
      if (detail.kind === 'crack') {
        ctx.strokeStyle = '#151c21';
        ctx.beginPath();
        ctx.moveTo(detail.x, detail.y);
        ctx.lineTo(detail.x + 16, detail.y + 5);
        ctx.lineTo(detail.x + 22, detail.y - 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = COLORS.grass;
        ctx.fillRect(detail.x, detail.y, 14, 6);
        ctx.fillRect(detail.x + 5, detail.y - 4, 5, 14);
      }
    }
  }

  drawObstacle(ctx, o) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(o.x + 8, o.y + 10, o.w, o.h);
    ctx.fillStyle = COLORS.outline;
    ctx.fillRect(o.x - 3, o.y - 3, o.w + 6, o.h + 6);
    if (o.type === 'building') {
      ctx.fillStyle = COLORS.wall;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = COLORS.roof;
      ctx.fillRect(o.x + 12, o.y + 12, o.w - 24, o.h - 24);
      ctx.fillStyle = '#f6d365';
      for (let x = o.x + 30; x < o.x + o.w - 20; x += 54) {
        ctx.fillRect(x, o.y + 32, 20, 16);
      }
    } else if (o.type === 'car') {
      ctx.fillStyle = '#3b6ea8';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = '#9ee7ff';
      ctx.fillRect(o.x + 16, o.y + 6, 30, o.h - 12);
      ctx.fillStyle = '#171d22';
      ctx.fillRect(o.x + 10, o.y - 4, 18, 8);
      ctx.fillRect(o.x + o.w - 28, o.y + o.h - 4, 18, 8);
    } else if (o.type === 'barrel') {
      ctx.fillStyle = '#a9413d';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = '#f0b35c';
      ctx.fillRect(o.x, o.y + o.h / 2 - 4, o.w, 8);
    } else {
      ctx.fillStyle = o.type === 'fence' ? '#8d7352' : '#b47a45';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = '#533a2b';
      for (let x = o.x + 8; x < o.x + o.w; x += 24) ctx.fillRect(x, o.y, 5, o.h);
    }
  }
}
