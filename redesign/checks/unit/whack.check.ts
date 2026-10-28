import test from 'node:test';
import assert from 'node:assert/strict';
import { newWhack, validWhack } from '../../src/lib/whack.ts';
import { validCheckpoint } from '../../src/lib/checkpoints.ts';
test('timed round validates duration, score, misses and absolute deadline', () => {
  const now = Date.now();
  for (const duration of ['30', '45', '60']) {
    const s = newWhack(duration, now);
    assert.equal(s.deadline, now + Number(duration) * 1000);
    assert.ok(validWhack(s, now));
    assert.ok(validCheckpoint('whack-a-mole', s));
    assert.equal(validWhack({ ...s, score: -1 }, now), false);
    assert.equal(validWhack({ ...s, deadline: s.deadline + 1 }, now), false);
  }
  assert.throws(() => newWhack('20'));
});
