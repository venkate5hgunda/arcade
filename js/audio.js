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
    this.warnedUnsupported = false;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master) this.master.gain.value = enabled ? 0.35 : 0;
  }

  async prepare() {
    if (!this.enabled) return false;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      if (!this.warnedUnsupported) console.warn('Web Audio is unavailable in this browser.');
      this.warnedUnsupported = true;
      return false;
    }
    try {
      if (!this.context || this.context.state === 'closed') {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.enabled ? 0.35 : 0;
        this.master.connect(this.context.destination);
        this.impactBuffer = null;
      }
      if (this.context.state !== 'running') {
        const unlock = this.context.createBufferSource();
        unlock.buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
        unlock.connect(this.master);
        unlock.start();
        await this.context.resume();
      }
      return this.context.state === 'running';
    } catch (error) {
      console.warn('Arcade audio could not start; try tapping Sound & feel again:', error);
      return false;
    }
  }

  whenReady(play, defer = true) {
    if (!this.enabled || this.silenced) return false;
    if (this.context?.state === 'running') return true;
    void this.prepare().then(ready => {
      if (defer && ready && this.enabled && !this.silenced) play();
    });
    return false;
  }

  // Low-level: schedule a tone. `freq` in Hz, `duration` in seconds.
  tone(freq, duration = 0.08, type = 'sine', volume = 0.5, delay = 0) {
    if (!this.whenReady(() => this.tone(freq, duration, type, volume, delay))) return;
    const now = this.context.currentTime + delay;
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
    if (!this.whenReady(() => this.chime())) return;
    [880, 1100, 1320].forEach((f, i) =>
      this.tone(f, 0.18, 'triangle', 0.22, i * 0.07));
  }

  // A "wrong" buzz.
  buzz() { this.tone(160, 0.2, 'sawtooth', 0.2); }

  hiss() {
    if (!this.whenReady(() => this.hiss(), false)) return;
    const now = this.context.currentTime;
    const noise = this.context.createBufferSource();
    const buffer = this.context.createBuffer(1, Math.floor(this.context.sampleRate * .55), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 900;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(.001, now);
    gain.gain.linearRampToValueAtTime(.13, now + .1);
    gain.gain.exponentialRampToValueAtTime(.001, now + .55);
    noise.connect(filter).connect(gain).connect(this.master);
    noise.start(now);
    noise.stop(now + .56);
  }

  // Rolling dice / spinning wheel: a sequence of short clicks.
  rattle(count = 6, base = 520) {
    if (!this.whenReady(() => this.rattle(count, base))) return;
    for (let i = 0; i < count; i++)
      this.tone(base + i * 18, 0.04, 'square', 0.12, i * 0.045);
  }

  // Ball strike / puck hit — short filtered noise burst.
  impact(intensity = 1) {
    if (!this.whenReady(() => this.impact(intensity), false)) return;
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
    if (!this.whenReady(() => this.goal())) return;
    [440, 554, 659, 880].forEach((f, i) =>
      this.tone(f, 0.22, 'triangle', 0.25, i * 0.06));
  }

  // Countdown tick-tock.
  tick() { this.tone(1000, 0.03, 'sine', 0.15); }
  tickLow() { this.tone(600, 0.05, 'sine', 0.15); }

  // Time's up.
  buzzer() { this.tone(140, 0.35, 'sawtooth', 0.25); }
}
