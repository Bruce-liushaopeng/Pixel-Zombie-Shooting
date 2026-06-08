import { COLORS, WORLD } from './constants.js';
import { rand } from './math.js';
import { getMapDefinition } from './MapDefinitions.js';
import { PathfindingGrid } from './PathfindingGrid.js';

export class World {
  constructor(mapId = 'city') {
    this.width = WORLD.width;
    this.height = WORLD.height;
    this.obstacles = [];
    this.details = [];
    this.roads = [];
    this.map = getMapDefinition(mapId);
    this.theme = { id: 'city', ground: COLORS.grassDark, road: COLORS.asphalt, accent: '#e7d98a' };
    this.build();
  }

  setTheme(theme) {
    this.theme = theme;
  }

  build() {
    this.obstacles = this.map.obstacles.map(([x, y, w, h, type]) => ({ x, y, w, h, type }));
    this.roads = this.map.roads || [];
    this.theme = this.map.theme || this.theme;

    for (let i = 0; i < 160; i++) {
      this.details.push({
        x: rand(20, this.width - 20),
        y: rand(20, this.height - 20),
        kind: this.map.detailKinds[Math.floor(Math.random() * this.map.detailKinds.length)],
      });
    }
    this.pathfindingGrid = new PathfindingGrid(this);
  }

  draw(ctx, camera) {
    const view = {
      x: Math.max(0, camera.x - 80),
      y: Math.max(0, camera.y - 80),
      w: camera.canvas.width + 160,
      h: camera.canvas.height + 160,
    };

    ctx.fillStyle = this.theme.ground || COLORS.grassDark;
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
    ctx.fillStyle = this.theme.road || COLORS.asphalt;
    for (const road of this.roads) {
      if (this.isVisible(road, view)) ctx.fillRect(road.x, road.y, road.w, road.h);
    }

    ctx.fillStyle = COLORS.curb;
    for (const road of this.roads) {
      const isHorizontal = road.w >= road.h;
      const edges = isHorizontal
        ? [{ x: road.x, y: road.y, w: road.w, h: 7 }, { x: road.x, y: road.y + road.h - 7, w: road.w, h: 7 }]
        : [{ x: road.x, y: road.y, w: 7, h: road.h }, { x: road.x + road.w - 7, y: road.y, w: 7, h: road.h }];
      for (const curb of edges) {
        if (this.isVisible(curb, view)) ctx.fillRect(curb.x, curb.y, curb.w, curb.h);
      }
    }

    ctx.fillStyle = this.theme.accent || '#e7d98a';
    for (const road of this.roads.filter((candidate) => candidate.w >= candidate.h)) {
      for (let x = Math.max(road.x + 24, Math.floor(view.x / 96) * 96); x < Math.min(road.x + road.w, view.x + view.w); x += 96) {
        ctx.fillRect(x, road.y + road.h / 2 - 3, 42, 5);
      }
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
      } else if (detail.kind === 'spark') {
        ctx.fillStyle = this.theme.accent || '#ffd166';
        ctx.fillRect(detail.x, detail.y, 5, 5);
      } else if (detail.kind === 'puddle') {
        ctx.fillStyle = 'rgba(112, 224, 0, 0.35)';
        ctx.fillRect(detail.x, detail.y, 18, 8);
      } else if (detail.kind === 'ice') {
        ctx.fillStyle = 'rgba(158, 231, 255, 0.38)';
        ctx.fillRect(detail.x, detail.y, 18, 5);
      } else if (detail.kind === 'neon') {
        ctx.fillStyle = this.theme.accent || '#b38cff';
        ctx.fillRect(detail.x, detail.y, 4, 18);
      } else if (detail.kind === 'snow') {
        ctx.fillStyle = 'rgba(214, 246, 255, 0.42)';
        ctx.fillRect(detail.x, detail.y, 20, 7);
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
    if (['building', 'industrial', 'outpost'].includes(o.type)) {
      ctx.fillStyle = o.type === 'industrial' ? '#304b42' : o.type === 'outpost' ? '#455a66' : COLORS.wall;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = o.type === 'industrial' ? '#1b3028' : o.type === 'outpost' ? '#d6f6ff' : COLORS.roof;
      ctx.fillRect(o.x + 12, o.y + 12, o.w - 24, o.h - 24);
      ctx.fillStyle = this.theme.accent || '#f6d365';
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
    } else if (o.type === 'barrel' || o.type === 'toxicBarrel') {
      ctx.fillStyle = o.type === 'toxicBarrel' ? '#276d3b' : '#a9413d';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = o.type === 'toxicBarrel' ? '#70e000' : '#f0b35c';
      ctx.fillRect(o.x, o.y + o.h / 2 - 4, o.w, 8);
    } else if (o.type === 'pipe' || o.type === 'grate') {
      ctx.fillStyle = o.type === 'pipe' ? '#45515a' : '#1b242c';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = this.theme.accent || '#70e000';
      for (let x = o.x + 8; x < o.x + o.w; x += 28) ctx.fillRect(x, o.y + 4, 4, Math.max(8, o.h - 8));
    } else if (o.type === 'lamp') {
      ctx.fillStyle = '#293944';
      ctx.fillRect(o.x + o.w / 2 - 5, o.y + 12, 10, o.h - 12);
      ctx.fillStyle = '#9ee7ff';
      ctx.fillRect(o.x + 14, o.y, o.w - 28, 18);
    } else {
      ctx.fillStyle = o.type === 'fence' ? '#8d7352' : o.type === 'crate' ? '#b47a45' : '#cfdfea';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = '#533a2b';
      for (let x = o.x + 8; x < o.x + o.w; x += 24) ctx.fillRect(x, o.y, 5, o.h);
    }
  }
}
