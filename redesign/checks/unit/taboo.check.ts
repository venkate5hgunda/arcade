import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CARDS,
  newTaboo,
  validTaboo,
  scoreTaboo,
  finishTurn,
} from '../../src/lib/taboo.ts';
import { validCheckpoint } from '../../src/lib/checkpoints.ts';
test('Taboo card list, scoring, deadlines and checkpoint validity match the original', async () => {
  const original = await import(
    pathToFileURL(resolve('../games/taboo.js')).href
  );
  assert.deepEqual(CARDS, original.CARDS);
  const now = Date.now();
  const base = newTaboo(30, 4);
  assert.equal(validTaboo(base, now), original.validState(base));
  assert.ok(validCheckpoint('taboo', base));
  const playing = { ...base, phase: 'playing' as const, deadline: now + 10000 };
  for (const points of [-1, 0, 1, 2]) {
    const old = structuredClone(playing),
      accepted = original.applyOutcome(old, points, now),
      next = scoreTaboo(playing, points, now);
    assert.equal(!!next, accepted);
    if (next) assert.deepEqual(next.scores, old.scores);
  }
  assert.equal(scoreTaboo(playing, 1, now + 10000), null);
  const next = finishTurn(playing);
  assert.equal(next.turn, 1);
  assert.equal(next.phase, 'ready');
  assert.equal(next.deadline, null);
  assert.ok(validTaboo(next));
});
