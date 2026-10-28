import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  HANGMAN_WORDS,
  createHangman,
  guessHangman,
  validHangmanState,
  wordCategory,
} from '../../src/lib/hangman.ts';
import { validCheckpoint } from '../../src/lib/checkpoints.ts';

test('Hangman word list, categories, transitions and validation match the original for complete games', async () => {
  const original = await import(
    pathToFileURL(resolve('../games/hangman-engine.js')).href
  );
  assert.deepEqual(HANGMAN_WORDS, original.HANGMAN_WORDS);
  for (const word of HANGMAN_WORDS)
    assert.equal(wordCategory(word), original.wordCategory(word));
  for (const players of ['1', '2'])
    for (const sample of [0, 0.5, 0.999])
      for (const letters of [
        'ARCADE',
        'BFGHIJ',
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      ]) {
        let state = createHangman(players, () => sample),
          old = original.createHangman(players, () => sample);
        for (const letter of letters) {
          assert.equal(
            validHangmanState(state),
            original.validHangmanState(old),
          );
          assert.equal(
            validCheckpoint('hangman', state),
            original.validHangmanState(old),
          );
          if (state.guessed.includes(letter)) continue;
          const result = guessHangman(state, letter),
            expected = original.guessHangman(old, letter);
          assert.deepEqual(result, expected);
          state = result.state;
          old = expected.state;
          if (result.outcome) break;
        }
      }
  const game = createHangman('1', () => 0);
  assert.throws(() => guessHangman(game, 'a'));
  assert.throws(() => guessHangman(guessHangman(game, 'A').state, 'A'));
});
