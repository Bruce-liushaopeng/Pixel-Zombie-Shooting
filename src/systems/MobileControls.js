const DEADZONE = 0.18;

function createStick(label) {
  const zone = document.createElement('div');
  zone.className = 'mobile-stick';
  zone.dataset.stick = label;
  zone.setAttribute('aria-hidden', 'true');

  const base = document.createElement('div');
  base.className = 'mobile-stick-base';

  const knob = document.createElement('div');
  knob.className = 'mobile-stick-knob';

  base.append(knob);
  zone.append(base);

  return { zone, base, knob };
}

export class MobileControls {
  constructor(frame) {
    this.frame = frame;
    this.deadzone = DEADZONE;
    this.move = this.createState('move');
    this.aim = this.createState('aim');
    this.enabled = false;
    this.container = document.createElement('div');
    this.container.className = 'mobile-controls';
    this.container.setAttribute('aria-hidden', 'true');

    const leftStick = createStick('move');
    const rightStick = createStick('aim');
    this.move.elements = leftStick;
    this.aim.elements = rightStick;
    this.container.append(leftStick.zone, rightStick.zone);
    this.frame.append(this.container);

    this.setupStick(this.move);
    this.setupStick(this.aim);
    this.setupGuards();
    this.visibilityQuery = window.matchMedia('(pointer: coarse), (hover: none), (max-width: 820px)');
    this.updateEnabled();
    this.visibilityQuery.addEventListener('change', () => this.updateEnabled());
    window.addEventListener('resize', () => this.updateEnabled());
    window.addEventListener('orientationchange', () => {
      this.resetStick(this.move);
      this.resetStick(this.aim);
      this.updateEnabled();
    });
  }

  createState(name) {
    return {
      name,
      pointerId: null,
      active: false,
      centerX: 0,
      centerY: 0,
      x: 0,
      y: 0,
      magnitude: 0,
      elements: null,
    };
  }

  setupGuards() {
    this.frame.addEventListener('contextmenu', (event) => event.preventDefault());
    this.frame.addEventListener('selectstart', (event) => event.preventDefault());
  }

  updateEnabled() {
    this.enabled = this.visibilityQuery.matches || window.innerWidth <= 820;
    this.container.classList.toggle('is-visible', this.enabled);
    if (!this.enabled) {
      this.resetStick(this.move);
      this.resetStick(this.aim);
    }
  }

  setupStick(stick) {
    const { zone } = stick.elements;
    zone.addEventListener('pointerdown', (event) => this.startStick(event, stick));
    zone.addEventListener('pointermove', (event) => this.moveStick(event, stick));
    zone.addEventListener('pointerup', (event) => this.endStick(event, stick));
    zone.addEventListener('pointercancel', (event) => this.endStick(event, stick));
    zone.addEventListener('lostpointercapture', (event) => this.endStick(event, stick));
  }

  startStick(event, stick) {
    if (!this.enabled || stick.pointerId !== null) return;
    event.preventDefault();
    stick.pointerId = event.pointerId;
    stick.active = true;
    stick.elements.zone.setPointerCapture(event.pointerId);
    const rect = stick.elements.base.getBoundingClientRect();
    stick.centerX = rect.left + rect.width / 2;
    stick.centerY = rect.top + rect.height / 2;
    this.updateStick(event, stick);
  }

  moveStick(event, stick) {
    if (event.pointerId !== stick.pointerId) return;
    event.preventDefault();
    this.updateStick(event, stick);
  }

  endStick(event, stick) {
    if (event.pointerId !== stick.pointerId) return;
    event.preventDefault();
    this.resetStick(stick);
  }

  updateStick(event, stick) {
    const radius = stick.elements.base.clientWidth / 2;
    const dx = event.clientX - stick.centerX;
    const dy = event.clientY - stick.centerY;
    const distance = Math.hypot(dx, dy);
    const clampedDistance = Math.min(distance, radius);
    const angle = Math.atan2(dy, dx);
    const knobX = Math.cos(angle) * clampedDistance;
    const knobY = Math.sin(angle) * clampedDistance;
    const rawX = radius ? knobX / radius : 0;
    const rawY = radius ? knobY / radius : 0;
    const magnitude = Math.min(1, Math.hypot(rawX, rawY));

    stick.elements.knob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
    stick.elements.zone.classList.add('is-active');

    if (magnitude < this.deadzone) {
      stick.x = 0;
      stick.y = 0;
      stick.magnitude = 0;
      return;
    }

    const scaledMagnitude = (magnitude - this.deadzone) / (1 - this.deadzone);
    stick.x = (rawX / magnitude) * scaledMagnitude;
    stick.y = (rawY / magnitude) * scaledMagnitude;
    stick.magnitude = scaledMagnitude;
  }

  resetStick(stick) {
    stick.pointerId = null;
    stick.active = false;
    stick.x = 0;
    stick.y = 0;
    stick.magnitude = 0;
    stick.elements.knob.style.transform = 'translate(-50%, -50%)';
    stick.elements.zone.classList.remove('is-active');
  }

  movementVector() {
    return { x: this.move.x, y: this.move.y };
  }

  aimVector() {
    return { x: this.aim.x, y: this.aim.y, magnitude: this.aim.magnitude, active: this.aim.active };
  }

  isAiming() {
    return this.aim.magnitude > 0;
  }
}
