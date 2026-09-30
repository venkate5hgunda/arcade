import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeAudio } from '../js/audio.js';

test('sound toggle restores volume when unmuted', () => {
  const audio = new ArcadeAudio();
  audio.master = { gain: { value: .55 } };
  audio.setEnabled(false);
  assert.equal(audio.master.gain.value, 0);
  audio.setEnabled(true);
  assert.equal(audio.master.gain.value, .55);
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
    assert.equal(audio.master.gain.value, .55);
  } finally {
    globalThis.window = previousWindow;
  }
});

test('a chime is scheduled within the gesture before mobile resume resolves', async () => {
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
    assert.deepEqual(contexts[0].starts, [0, .07, .14],
      'audible tones are scheduled while the gesture is active');
    contexts[0].finishResume();
    await new Promise(setImmediate);
    assert.deepEqual(contexts[0].starts, [0, .07, .14]);

    contexts[0].state = 'suspended';
    audio.chime();
    audio.setEnabled(false);
    assert.equal(audio.master.gain.value, 0, 'muting also silences tones queued during resume');
    contexts[0].finishResume();
    await new Promise(setImmediate);
    assert.equal(contexts[0].starts.length, 6, 'resuming does not duplicate queued tones');
  } finally {
    globalThis.window = previousWindow;
  }
});

test('Chrome on iOS uses playback routing when available and releases it when sound is off', async () => {
  const previousWindow = globalThis.window;
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const session = { type: 'auto' };
  let categoryAtCreation;
  class MobileContext {
    constructor() {
      categoryAtCreation = session.type;
      this.state = 'running'; this.destination = {};
    }
    createGain() { return { gain: { value: 0 }, connect() { return this; } }; }
  }
  try {
    globalThis.window = { AudioContext: MobileContext };
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) CriOS/120.0', audioSession: session },
    });
    const audio = new ArcadeAudio();
    assert.equal(await audio.prepare(), true);
    assert.equal(categoryAtCreation, 'playback');
    assert.equal(audio.playbackSession, true);
    session.type = 'auto';
    assert.equal(await audio.prepare(), true);
    assert.equal(session.type, 'playback', 'reselect playback after an iOS interruption');
    audio.setEnabled(false);
    assert.equal(session.type, 'auto');
    audio.setEnabled(true);
    assert.equal(await audio.prepare(), true);
    assert.equal(session.type, 'playback');
  } finally {
    globalThis.window = previousWindow;
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
    else delete globalThis.navigator;
  }
});
