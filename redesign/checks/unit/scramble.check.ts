import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newScramble,
  nextScramble,
  validScramble,
  SCRAMBLE_WORDS,
} from '../../src/lib/scramble.ts';
import { validCheckpoint } from '../../src/lib/checkpoints.ts';
test('scramble starts unique shuffled rounds, preserves checkpoints and ends at the configured count', () => {
  for (const rounds of ['5', '8', '12']) {
    let state = newScramble(rounds, () => 0.5);
    const seen = new Set<string>();
    for (let i = 1; i <= Number(rounds); i++) {
      assert.ok(validScramble(state));
      assert.ok(validCheckpoint('word-scramble', state));
      assert.equal(state.round, i);
      assert.ok(!seen.has(state.word));
      seen.add(state.word);
      assert.notEqual(state.letters.join(''), state.word);
      state = nextScramble(state, () => 0.5);
    }
    assert.equal(state.round, Number(rounds) + 1);
    assert.equal(validScramble(state), false);
  }
  assert.equal(new Set(SCRAMBLE_WORDS).size, 35);
  assert.throws(() => newScramble('3'));
});
