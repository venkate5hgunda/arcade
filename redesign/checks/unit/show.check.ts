import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  SYMBOLS,
  deal,
  matches,
  passChits,
  stackPoints,
  validShow,
  newShow,
} from '../../src/lib/show.ts';
import { validCheckpoint } from '../../src/lib/checkpoints.ts';
test('Show deals, passes, scores and validates the original chits', async () => {
  const original = await import(
    pathToFileURL(resolve('../games/show-star.js')).href
  );
  assert.deepEqual(SYMBOLS, original.SYMBOLS);
  for (let players = 3; players <= 8; players++) {
    const hands = deal(players, () => 0.5);
    assert.deepEqual(
      hands,
      original.deal(players, () => 0.5),
    );
    const picks = Array(players).fill(0);
    assert.deepEqual(passChits(hands, picks), original.passChits(hands, picks));
    assert.deepEqual(
      stackPoints(
        Array.from({ length: players }, (_, i) => i).reverse(),
        players,
      ),
      original.stackPoints(
        Array.from({ length: players }, (_, i) => i).reverse(),
        players,
      ),
    );
    assert.equal(matches(hands[0]), original.matches(hands[0]));
    const state = { ...newShow(players, 3), hands };
    assert.equal(validShow(state), original.validState(state));
    assert.equal(
      validCheckpoint('show-star', state),
      original.validState(state),
    );
  }
});
