export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false, pressed: false };
    this.pausePressed = false;

    window.addEventListener('keydown', (event) => {
      this.keys.add(event.key.toLowerCase());
      if (event.key.toLowerCase() === 'p' || event.key === 'Escape') this.pausePressed = true;
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
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  }

  consumeFrameFlags() {
    this.mouse.pressed = false;
    this.pausePressed = false;
  }
}
