export class SpecialAbilityManager {
  constructor() {
    this.charge = 0;
    this.chargeTime = 30;
    this.state = 'charging';
  }

  update(dt) {
    if (this.state === 'activated') this.state = 'charging';
    this.addCharge(dt / this.chargeTime);
  }

  addCharge(amount) {
    this.charge = Math.min(1, this.charge + amount);
    if (this.charge >= 1) this.state = 'ready';
  }

  canUse() {
    return this.charge >= 1;
  }

  use() {
    if (!this.canUse()) return false;
    this.charge = 0;
    this.state = 'activated';
    return true;
  }

  percent() {
    return Math.round(this.charge * 100);
  }
}

