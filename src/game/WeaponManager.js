import { getWeapon, WEAPON_LIST } from '../entities/WeaponTypes.js';

export class WeaponManager {
  constructor() {
    this.currentId = 'pistol';
    this.ammo = new Map();
  }

  current() {
    return getWeapon(this.currentId);
  }

  currentAmmo() {
    const weapon = this.current();
    return weapon.ammo === Infinity ? Infinity : this.ammo.get(weapon.id) || 0;
  }

  canShoot() {
    return this.current().ammo === Infinity || this.currentAmmo() > 0;
  }

  consumeAmmo() {
    const weapon = this.current();
    if (weapon.ammo === Infinity) return;
    const next = Math.max(0, this.currentAmmo() - 1);
    this.ammo.set(weapon.id, next);
    if (next <= 0) this.currentId = 'pistol';
  }

  buy(weaponId, money) {
    const weapon = getWeapon(weaponId);
    if (money < weapon.price) return { ok: false, message: 'Not enough money.' };
    if (weapon.id !== 'pistol') this.ammo.set(weapon.id, (this.ammo.get(weapon.id) || 0) + weapon.ammo * 4);
    this.currentId = weapon.id;
    return { ok: true, cost: weapon.price, message: `${weapon.name} equipped.` };
  }

  equip(weaponId) {
    const weapon = getWeapon(weaponId);
    if (weapon.ammo !== Infinity && this.currentAmmoFor(weapon.id) <= 0) return false;
    this.currentId = weapon.id;
    return true;
  }

  resetToPistol({ clearAmmo = true } = {}) {
    this.currentId = 'pistol';
    if (clearAmmo) this.ammo.clear();
  }

  currentAmmoFor(weaponId) {
    const weapon = getWeapon(weaponId);
    return weapon.ammo === Infinity ? Infinity : this.ammo.get(weapon.id) || 0;
  }

  list() {
    return WEAPON_LIST.map((weapon) => ({
      ...weapon,
      purchaseAmmo: weapon.ammo === Infinity ? Infinity : weapon.ammo * 4,
      ownedAmmo: this.currentAmmoFor(weapon.id),
      equipped: weapon.id === this.currentId,
    }));
  }
}
