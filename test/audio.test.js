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
