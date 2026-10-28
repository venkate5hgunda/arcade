import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeAudio } from '../../src/lib/audio-core.js';

test('audio unlocks on a gesture, resumes after interruption and mutes the shared output', async () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const instances: FakeContext[] = [];
  class FakeContext {
    state = 'suspended';
    currentTime = 0;
    destination = {};
    sampleRate = 48000;
    starts = 0;
    unlocks = 0;
    gain = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} };
    constructor() {
      instances.push(this);
    }
    createGain() {
      return {
        gain: this.gain,
        connect() {
          return this;
        },
      };
    }
    createBuffer() {
      return {};
    }
    createBufferSource() {
      return {
        connect() {
          return this;
        },
        start: () => {
          this.unlocks++;
        },
      };
    }
    createOscillator() {
      return {
        frequency: { value: 0 },
        connect() {
          return this;
        },
        start: () => {
          this.starts++;
        },
        stop() {},
      };
    }
    async resume() {
      this.state = 'running';
    }
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { AudioContext: FakeContext },
  });
  try {
    const audio = new ArcadeAudio();
    assert.equal(await audio.prepare(), true);
    assert.equal(instances[0].unlocks, 1);
    audio.chime();
    assert.equal(instances[0].starts, 3);
    instances[0].state = 'interrupted';
    assert.equal(await audio.prepare(), true);
    assert.equal(instances[0].unlocks, 2);
    audio.setEnabled(false);
    assert.equal(instances[0].gain.value, 0);
    assert.equal(await audio.prepare(), false);
    audio.setEnabled(true);
    assert.equal(instances[0].gain.value, 0.55);
  } finally {
    if (prior) Object.defineProperty(globalThis, 'window', prior);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
