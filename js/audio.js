// Arcade audio engine — pure Web Audio synthesis, no external assets.
// A single shared AudioContext is created lazily on first user gesture and
// resumed across the session. All sound is tiny synthesized blips/beeps so the
// PWA stays lightweight and works offline.

const TAU = Math.PI * 2;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export class ArcadeAudio {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.context = null;
    this.master = null;
    this.silenced = false;
    this.impactBuffer = null;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master) this.master.gain.value = enabled ? 0.35 : 0;
  }

  async prepare() {
    if (!this.enabled) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? 0.35 : 0;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') {
      try { await this.context.resume(); }
      catch (error) { console.warn('Arcade audio could not resume:', error); }
    }
  }

  // Low-level: schedule a tone. `freq` in Hz, `duration` in seconds.
  tone(freq, duration = 0.08, type = 'sine', volume = 0.5) {
    if (!this.enabled || this.silenced || !this.context) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // A quick ascending "blip" used for UI taps / menu selections.
  tap() { this.tone(660, 0.05, 'sine', 0.18); }

  // A short descending "pop" used for dismiss / cancel actions.
  pop() { this.tone(330, 0.06, 'sine', 0.18); }

  // A pleasant confirmation chime for correct answers / wins.
  chime() {
    if (!this.enabled || this.silenced || !this.context) return;
    [880, 1100, 1320].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.18, 'triangle', 0.22), i * 70);
    });
  }

  // A "wrong" buzz.
  buzz() { this.tone(160, 0.2, 'sawtooth', 0.2); }

  // Rolling dice / spinning wheel: a sequence of short clicks.
  rattle(count = 6, base = 520) {
    if (!this.enabled || this.silenced || !this.context) return;
    for (let i = 0; i < count; i++) {
      setTimeout(() => this.tone(base + i * 18, 0.04, 'square', 0.12), i * 45);
    }
  }

  // Ball strike / puck hit — short filtered noise burst.
  impact(intensity = 1) {
    if (!this.enabled || this.silenced || !this.context) return;
    const now = this.context.currentTime;
    const noise = this.context.createBufferSource();
    if (!this.impactBuffer) {
      this.impactBuffer = this.context.createBuffer(1, this.context.sampleRate * 0.08, this.context.sampleRate);
      const data = this.impactBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    noise.buffer = this.impactBuffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(clamp(0.25 * intensity, 0.001, 0.6), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    noise.connect(filter).connect(gain).connect(this.master);
    noise.start(now);
    noise.stop(now + 0.09);
  }

  // Goal scored — rising chime.
  goal() {
    if (!this.enabled || this.silenced || !this.context) return;
    [440, 554, 659, 880].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.22, 'triangle', 0.25), i * 60);
    });
  }

  // Countdown tick-tock.
  tick() { this.tone(1000, 0.03, 'sine', 0.15); }
  tickLow() { this.tone(600, 0.05, 'sine', 0.15); }

  // Time's up.
  buzzer() { this.tone(140, 0.35, 'sawtooth', 0.25); }
}
