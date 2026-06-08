export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicNotes = [220, 277, 330, 392];
    this.musicGain = 0.016;
  }

  resume() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.setMusic(this.musicNotes);
  }

  toggleMute() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  tone({ frequency = 220, duration = 0.08, type = 'square', gain = 0.06, slide = 0 }) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, frequency + slide), now + duration);
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(amp).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  shoot() {
    this.tone({ frequency: 520, duration: 0.045, gain: 0.035, slide: -180 });
  }

  hit() {
    this.tone({ frequency: 130, duration: 0.09, type: 'sawtooth', gain: 0.05, slide: -70 });
  }

  pickup() {
    this.tone({ frequency: 760, duration: 0.1, type: 'triangle', gain: 0.045, slide: 280 });
  }

  enemyDown() {
    this.tone({ frequency: 190, duration: 0.12, type: 'square', gain: 0.05, slide: -120 });
  }

  setMusic(notes, boss = false) {
    this.musicNotes = notes || this.musicNotes;
    this.musicGain = boss ? 0.026 : 0.016;
    const interval = boss ? 180 : 260;
    if (!this.ctx) return;
    if (this.musicTimer && this.musicInterval === interval) return;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicInterval = interval;
    this.musicTimer = setInterval(() => this.musicTick(), interval);
  }

  musicTick() {
    if (!this.enabled || !this.ctx) return;
    const note = this.musicNotes[this.musicStep % this.musicNotes.length] * (this.musicStep % 8 === 7 ? 2 : 1);
    this.musicStep += 1;
    this.tone({ frequency: note, duration: 0.08, type: 'triangle', gain: this.musicGain });
  }
}
