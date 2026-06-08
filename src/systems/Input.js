import { MobileControls } from './MobileControls.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.frame = canvas.closest('.canvas-frame') || canvas.parentElement;
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false, pressed: false };
    this.pausePressed = false;
    this.shopPressed = false;
    this.specialPressed = false;
    this.audioPressed = false;
    this.mobile = new MobileControls(this.frame);
    this.lastMobileAim = { x: 1, y: 0 };

    window.addEventListener('keydown', (event) => {
      this.keys.add(event.key.toLowerCase());
      if (event.key.toLowerCase() === 'p' || event.key === 'Escape') this.pausePressed = true;
      if (event.key.toLowerCase() === 'b') this.shopPressed = true;
      if (event.key === ' ' || event.key.toLowerCase() === 'q') this.specialPressed = true;
      if (event.key.toLowerCase() === 'm') this.audioPressed = true;
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.key.toLowerCase()));

    canvas.addEventListener('mousemove', (event) => this.setMouse(event));
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        this.mouse.down = true;
        this.mouse.pressed = true;
      }
    });
    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  setGameplayActive(active) {
    this.mobile.setGameplayActive(active);
  }

  setMouse(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    this.mouse.x = (event.clientX - rect.left) * scaleX;
    this.mouse.y = (event.clientY - rect.top) * scaleY;
  }

  movementVector() {
    const left = this.keys.has('a') || this.keys.has('arrowleft');
    const right = this.keys.has('d') || this.keys.has('arrowright');
    const up = this.keys.has('w') || this.keys.has('arrowup');
    const down = this.keys.has('s') || this.keys.has('arrowdown');
    const x = Number(right) - Number(left);
    const y = Number(down) - Number(up);
    const mobileMove = this.mobile.movementVector();
    if (Math.hypot(mobileMove.x, mobileMove.y) > 0) return mobileMove;
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  }

  aimVector() {
    return this.mobile.aimVector();
  }

  isMobileShooting() {
    return this.mobile.gameplayActive && this.mobile.isAiming();
  }

  aimTarget(player, mouseWorld) {
    const aim = this.aimVector();
    if (aim.magnitude > 0) {
      this.lastMobileAim = { x: aim.x, y: aim.y };
      return {
        x: player.x + aim.x * 160,
        y: player.y + aim.y * 160,
      };
    }
    if (this.mobile.enabled && this.mobile.gameplayActive) {
      return {
        x: player.x + this.lastMobileAim.x * 160,
        y: player.y + this.lastMobileAim.y * 160,
      };
    }
    return mouseWorld;
  }

  consumeFrameFlags() {
    this.mouse.pressed = false;
    this.pausePressed = false;
    this.shopPressed = false;
    this.specialPressed = false;
    this.audioPressed = false;
  }
}
