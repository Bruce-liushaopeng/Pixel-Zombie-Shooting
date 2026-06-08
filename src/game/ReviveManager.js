export class ReviveManager {
  constructor() {
    this.isDowned = false;
    this.deathCount = 0;
    this.timer = 0;
  }

  down() {
    this.deathCount += 1;
    this.isDowned = true;
    this.timer = Math.min(15, [3, 5, 7, 10][this.deathCount - 1] || 10 + (this.deathCount - 4) * 2);
    return this.timer;
  }

  update(dt) {
    if (!this.isDowned) return false;
    this.timer = Math.max(0, this.timer - dt);
    return this.timer <= 0;
  }

  revive() {
    this.isDowned = false;
    this.timer = 0;
  }
}

