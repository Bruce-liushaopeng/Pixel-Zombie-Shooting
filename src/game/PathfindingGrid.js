import { WORLD } from './constants.js';

export class PathfindingGrid {
  constructor(world, cellSize = WORLD.tile) {
    this.world = world;
    this.cellSize = cellSize;
    this.cols = Math.ceil(world.width / cellSize);
    this.rows = Math.ceil(world.height / cellSize);
    this.cells = Array.from({ length: this.rows }, () => Array.from({ length: this.cols }, () => ({ blocked: false, cost: 1 })));
    this.build();
  }

  build() {
    for (const road of this.world.roads || []) {
      this.forRectCells(road, (x, y) => {
        this.cells[y][x].cost = Math.min(this.cells[y][x].cost, road.cost || 0.7);
      });
    }
    for (const obstacle of this.world.obstacles || []) {
      const padded = { x: obstacle.x - 14, y: obstacle.y - 14, w: obstacle.w + 28, h: obstacle.h + 28 };
      this.forRectCells(padded, (x, y) => {
        this.cells[y][x].blocked = true;
      });
    }
  }

  forRectCells(rect, callback) {
    const min = this.worldToCell(rect.x, rect.y);
    const max = this.worldToCell(rect.x + rect.w, rect.y + rect.h);
    for (let y = Math.max(0, min.y); y <= Math.min(this.rows - 1, max.y); y++) {
      for (let x = Math.max(0, min.x); x <= Math.min(this.cols - 1, max.x); x++) callback(x, y);
    }
  }

  worldToCell(x, y) {
    return {
      x: Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cellSize))),
      y: Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cellSize))),
    };
  }

  cellToWorld(x, y) {
    return {
      x: x * this.cellSize + this.cellSize / 2,
      y: y * this.cellSize + this.cellSize / 2,
    };
  }

  isBlockedCell(x, y) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return true;
    return this.cells[y][x].blocked;
  }

  hasLineOfSight(a, b) {
    const steps = Math.max(4, Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / (this.cellSize * 0.55)));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const cell = this.worldToCell(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      if (this.isBlockedCell(cell.x, cell.y)) return false;
    }
    return true;
  }

  nearestOpenCell(cell) {
    if (!this.isBlockedCell(cell.x, cell.y)) return cell;
    for (let radius = 1; radius <= 5; radius++) {
      for (let y = cell.y - radius; y <= cell.y + radius; y++) {
        for (let x = cell.x - radius; x <= cell.x + radius; x++) {
          if (!this.isBlockedCell(x, y)) return { x, y };
        }
      }
    }
    return null;
  }

  findPath(startWorld, targetWorld, maxIterations = 900) {
    const start = this.nearestOpenCell(this.worldToCell(startWorld.x, startWorld.y));
    const goal = this.nearestOpenCell(this.worldToCell(targetWorld.x, targetWorld.y));
    if (!start || !goal) return [];

    const key = (cell) => `${cell.x},${cell.y}`;
    const open = [{ ...start, g: 0, f: this.heuristic(start, goal), parent: null }];
    const best = new Map([[key(start), open[0]]]);
    const closed = new Set();
    const directions = [
      { x: 1, y: 0, c: 1 }, { x: -1, y: 0, c: 1 }, { x: 0, y: 1, c: 1 }, { x: 0, y: -1, c: 1 },
      { x: 1, y: 1, c: 1.4 }, { x: 1, y: -1, c: 1.4 }, { x: -1, y: 1, c: 1.4 }, { x: -1, y: -1, c: 1.4 },
    ];

    for (let iterations = 0; open.length && iterations < maxIterations; iterations++) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift();
      const currentKey = key(current);
      if (closed.has(currentKey)) continue;
      if (current.x === goal.x && current.y === goal.y) return this.reconstruct(current);
      closed.add(currentKey);

      for (const dir of directions) {
        const next = { x: current.x + dir.x, y: current.y + dir.y };
        const nextKey = key(next);
        if (closed.has(nextKey) || this.isBlockedCell(next.x, next.y)) continue;
        const cell = this.cells[next.y][next.x];
        const g = current.g + dir.c * cell.cost;
        const known = best.get(nextKey);
        if (known && known.g <= g) continue;
        const node = { ...next, g, f: g + this.heuristic(next, goal), parent: current };
        best.set(nextKey, node);
        open.push(node);
      }
    }
    return [];
  }

  heuristic(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  reconstruct(node) {
    const cells = [];
    let current = node;
    while (current) {
      cells.push(this.cellToWorld(current.x, current.y));
      current = current.parent;
    }
    return cells.reverse().slice(1, 8);
  }
}
