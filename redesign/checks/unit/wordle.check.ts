import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WORDS, evaluateGuess, validWordle } from '../../src/lib/wordle.ts';
import { validCheckpoint } from '../../src/lib/checkpoints.ts';

test('Wordle practice vocabulary, duplicate-letter scoring and saved rounds match the original', async () => {
  const original = await import(
    pathToFileURL(resolve('../games/wordle.js')).href
  );
  assert.deepEqual(WORDS, original.WORDS);
  for (const answer of ['APPLE', 'SHEEP', 'LEVEL', 'SPEED', 'ALLEY'])
    for (const guess of ['APPLE', 'SHEEP', 'LEVEL', 'SPEED', 'ALLEY'])
      assert.deepEqual(
        evaluateGuess(guess, answer),
        original.evaluateGuess(guess, answer),
      );
  for (const state of [
    { answer: 'APPLE', guesses: [] },
    { answer: 'APPLE', guesses: ['SHEEP'] },
    { answer: 'APPLE', guesses: ['APPLE'] },
    { answer: 'NOT A WORD', guesses: [] },
    { answer: 'APPLE', guesses: Array(6).fill('SHEEP') },
  ]) {
    assert.equal(validWordle(state), original.validState(state));
    assert.equal(validCheckpoint('wordle', state), original.validState(state));
  }
});
