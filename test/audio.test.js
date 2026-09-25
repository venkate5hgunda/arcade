import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeAudio } from '../js/audio.js';

test('sound toggle restores volume when unmuted', () => {
  const audio = new ArcadeAudio();
  audio.master = { gain: { value: .35 } };
  audio.setEnabled(false);
  assert.equal(audio.master.gain.value, 0);
  audio.setEnabled(true);
  assert.equal(audio.master.gain.value, .35);
});

test('audio unlocks on a gesture, recovers interrupted and closed mobile contexts', async () => {
  const previousWindow = globalThis.window;
  const contexts = [];
  class FakeAudioContext {
    constructor() {
      this.state = 'suspended';
      this.currentTime = 0;
      this.destination = {};
      this.resumes = 0;
      this.tones = 0;
      contexts.push(this);
    }
    createGain() {
      return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() { return this; } };
    }
    createOscillator() {
      return { frequency: { value: 0 }, connect() { return this; },
        start: () => { this.tones++; }, stop() {} };
    }
    async resume() { this.resumes++; this.state = 'running'; }
  }
  try {
    globalThis.window = { AudioContext: FakeAudioContext };
    const audio = new ArcadeAudio();
    assert.equal(await audio.prepare(), true);
    assert.equal(contexts[0].tones, 1, 'a silent oscillator unlocks the initial mobile context');
    contexts[0].state = 'interrupted';
    audio.tap();
    await new Promise(setImmediate);
    assert.equal(contexts[0].resumes, 2);
    assert.equal(contexts[0].tones, 2, 'interrupted tone plays after the context resumes');
    contexts[0].state = 'closed';
    assert.equal(await audio.prepare(), true);
    assert.equal(contexts.length, 2);
    assert.equal(audio.master.gain.value, .35);
  } finally {
    globalThis.window = previousWindow;
  }
});
