import test from 'node:test';
import assert from 'node:assert/strict';
import {
  THROWS,
  rpsWinner,
  newRps,
  pickRps,
  revealRps,
  nextRps,
  validRps,
  rpsDone,
  newRpsRoom,
  applyRpsRoom,
  revealRpsRoom,
  rpsView,
  validRpsRoom,
  validRpsView,
} from '../../src/lib/rps.ts';
import { validCheckpoint } from '../../src/lib/checkpoints.ts';
test('all throws, ties, target lengths, hidden handoffs and exactly-once deadline settlement', () => {
  const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  for (const a of THROWS)
    for (const b of THROWS)
      assert.equal(rpsWinner(a, b), a === b ? null : beats[a] === b ? 0 : 1);
  for (const target of [3, 5, 7]) {
    let s = newRps('pvp', target);
    for (let i = 0; i < target; i++) {
      assert.ok(validCheckpoint('rps', s));
      s = pickRps(s, 'rock', 1);
      assert.equal(s.phase, 'handoff');
      s = pickRps({ ...s, phase: 'p2pick' }, 'scissors', 1);
      assert.equal(revealRps(s, 2240), s);
      s = revealRps(s, 2241);
      assert.equal(revealRps(s, 3000), s);
      assert.equal(s.score[0], i + 1);
      assert.equal(validRps(s), i + 1 !== target);
      if (i + 1 !== target) s = nextRps(s);
    }
    assert.ok(rpsDone(s));
    assert.ok(validRps(s, true));
    assert.equal(nextRps(s), s);
  }
  let s = revealRps(
    pickRps(newRps('ai', 3), 'rock', 1, () => 0),
    2241,
  );
  assert.deepEqual(s.score, [0, 0]);
  assert.equal(s.round, 1);
  assert.ok(validRps(s));
});
test('private projections conceal both throws until reveal and validate backups', () => {
  let s = newRpsRoom();
  s = applyRpsRoom(s, { type: 'pick', choice: 'paper' }, 1, 10)!;
  assert.equal(rpsView(s, 0).ownPick, null);
  assert.equal(rpsView(s, 0).revealed, null);
  assert.ok(validRpsRoom(s));
  assert.equal(applyRpsRoom(s, { type: 'pick', choice: 'rock' }, 1, 10), null);
  s = applyRpsRoom(s, { type: 'pick', choice: 'rock' }, 0, 10)!;
  assert.equal(rpsView(s, 1).revealed, null);
  assert.equal(revealRpsRoom(s, 2249), null);
  s = revealRpsRoom(s, 2250)!;
  assert.deepEqual(s.score, [0, 1]);
  assert.deepEqual(rpsView(s, 0).revealed, ['rock', 'paper']);
  assert.ok(validRpsRoom(s));
  assert.equal(validRpsView({ ...rpsView(s, 0), picks: s.picks }), false);
  assert.equal(validRpsRoom({ picks: [] }), false);
});
