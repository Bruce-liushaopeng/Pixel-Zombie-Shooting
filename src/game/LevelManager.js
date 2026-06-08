export class LevelManager {
  constructor() {
    this.level = 1;
  }

  nextScore() {
    return LevelManager.scoreForLevel(this.level + 1);
  }

  progress(score) {
    const current = this.level === 1 ? 0 : LevelManager.scoreForLevel(this.level);
    const next = this.nextScore();
    return {
      level: this.level,
      current,
      next,
      earned: Math.max(0, score - current),
      needed: next - current,
      percent: Math.max(0, Math.min(1, (score - current) / (next - current))),
    };
  }

  update(score) {
    let leveled = false;
    while (score >= this.nextScore()) {
      this.level += 1;
      leveled = true;
    }
    return leveled;
  }

  damageMultiplier() {
    return 1;
  }

  damageBonus() {
    return (this.level - 1) * 0.5;
  }

  specialMultiplier() {
    return 1;
  }

  static scoreForLevel(level) {
    if (level <= 1) return 0;
    return Math.round(25 * level * level + 25 * level - 50);
  }
}
