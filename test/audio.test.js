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
      this.currentTime = 4;
      this.destination = {};
      this.resumes = 0;
      this.tones = 0;
      this.starts = [];
      this.unlocks = 0;
      contexts.push(this);
    }
    createGain() {
      return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() { return this; } };
    }
    createOscillator() {
      return { frequency: { value: 0 }, connect() { return this; },
        start: time => { this.tones++; this.starts.push(time); }, stop() {} };
    }
    createBuffer() { return {}; }
    createBufferSource() {
      return { connect() { return this; }, start: () => { this.unlocks++; } };
    }
    async resume() { this.resumes++; this.state = 'running'; }
  }
  try {
    globalThis.window = { AudioContext: FakeAudioContext };
    const audio = new ArcadeAudio();
    assert.equal(await audio.prepare(), true);
    assert.equal(contexts[0].unlocks, 1, 'a silent buffer unlocks the initial mobile context');
    contexts[0].state = 'interrupted';
    audio.tap();
    await new Promise(setImmediate);
    assert.equal(contexts[0].resumes, 2);
    assert.equal(contexts[0].unlocks, 2, 'interrupted context is unlocked on another gesture');
    assert.equal(contexts[0].tones, 1, 'interrupted tone plays after the context resumes');
    contexts[0].state = 'interrupted';
    audio.chime();
    await new Promise(setImmediate);
    assert.deepEqual(contexts[0].starts.slice(-3), [4, 4.07, 4.14],
      'the full chime is scheduled on the audio clock after interruption');
    contexts[0].state = 'closed';
    assert.equal(await audio.prepare(), true);
    assert.equal(contexts.length, 2);
    assert.equal(audio.master.gain.value, .35);
  } finally {
    globalThis.window = previousWindow;
  }
});

test('a chime requested before audio unlock plays after resume, but not after muting', async () => {
  const previousWindow = globalThis.window;
  const contexts = [];
  class DeferredContext {
    constructor() {
      this.state = 'suspended'; this.currentTime = 0; this.destination = {};
      this.starts = []; this.unlocks = 0; contexts.push(this);
    }
    createGain() {
      return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() { return this; } };
    }
    createOscillator() {
      return { frequency: { value: 0 }, connect() { return this; },
        start: time => this.starts.push(time), stop() {} };
    }
    createBuffer() { return {}; }
    createBufferSource() {
      return { connect() { return this; }, start: () => { this.unlocks++; } };
    }
    resume() {
      return new Promise(resolve => { this.finishResume = () => { this.state = 'running'; resolve(); }; });
    }
  }
  try {
    globalThis.window = { webkitAudioContext: DeferredContext };
    const audio = new ArcadeAudio();
    audio.chime();
    assert.equal(contexts[0].unlocks, 1, 'initial silent unlock starts synchronously');
    contexts[0].finishResume();
    await new Promise(setImmediate);
    assert.deepEqual(contexts[0].starts, [0, .07, .14]);

    contexts[0].state = 'suspended';
    audio.chime();
    audio.setEnabled(false);
    contexts[0].finishResume();
    await new Promise(setImmediate);
    assert.equal(contexts[0].starts.length, 3, 'muting cancels a deferred effect');
  } finally {
    globalThis.window = previousWindow;
  }
});
