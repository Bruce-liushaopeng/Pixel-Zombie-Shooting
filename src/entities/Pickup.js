import { ABILITIES } from '../game/constants.js';

const PICKUPS = [
  ['speed', ABILITIES.speed],
  ['rapid', ABILITIES.rapid],
  ['big', ABILITIES.big],
  ['spread', ABILITIES.spread],
  ['shield', ABILITIES.shield],
  ['invincible', ABILITIES.invincible],
  ['damage', ABILITIES.damage],
  ['health', { label: 'Med', duration: 0, color: '#7bed9f', icon: '+' }],
];

export class Pickup {
  constructor(x, y, forcedType = null) {
    const [type, meta] = forcedType
      ? [forcedType, forcedType === 'health' ? PICKUPS.at(-1)[1] : ABILITIES[forcedType]]
      : PICKUPS[Math.floor(Math.random() * PICKUPS.length)];
    this.x = x;
    this.y = y;
    this.r = 18;
    this.type = type;
    this.color = meta.color;
    this.icon = meta.icon;
    this.duration = meta.duration;
    this.pulse = Math.random() * 6;
    this.dead = false;
  }

  update(dt) {
    this.pulse += dt * 3;
  }
}
