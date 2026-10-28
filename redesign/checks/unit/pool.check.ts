import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  newPool,
  rack,
  validPool,
  worldPool,
  shootPool,
  stepPool,
  finishPoolShot,
} from '../../src/lib/pool.ts';
import type { PoolState, PoolWorld } from '../../src/lib/pool.ts';
import { validCheckpoint } from '../../src/lib/checkpoints.ts';
function physicsFinish(w: PoolWorld) {
  for (let i = 0; i < 3000 && w.rolling; i++) stepPool(w, 1 / 120);
  assert.equal(w.rolling, false);
}
function eightFixture(legal: boolean): PoolState {
  const s = newPool('1');
  s.assignments = legal ? ['solids', 'stripes'] : [null, null];
  for (const b of s.balls) {
    if (b.number > 0 && b.number < 8) b.pocketed = true;
    if (b.number === 0) {
      b.x = 885;
      b.y = 55;
    }
    if (b.number === 8) {
      b.x = 911;
      b.y = 55;
    }
  }
  return s;
}
test('original rack and saved shape are preserved', () => {
  const source = readFileSync('../games/pool.js', 'utf8'),
    code = source.slice(
      source.indexOf('const W ='),
      source.indexOf('export default {'),
    );
  const old = runInNewContext(`${code}; ({rack,validCheckpoint})`, {
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
  });
  const s = newPool('1');
  assert.ok(validPool(s));
  assert.equal(validPool(s), old.validCheckpoint(s));
  assert.ok(validCheckpoint('pool', s));
  const balls = old.rack();
  assert.deepEqual(
    rack(() => 0),
    JSON.parse(
      JSON.stringify(
        balls.map(
          ({ number, x, y }: { number: number; x: number; y: number }) => ({
            number,
            x,
            y,
            pocketed: false,
          }),
        ),
      ),
    ),
  );
  assert.equal(balls[5].number, 8);
  assert.equal(balls.length, 16);
  assert.equal(s.balls[5].number, 8);
  assert.equal(
    validPool({
      ...s,
      balls: s.balls.map((b, i) => (i === 1 ? { ...b, number: 0 } : b)),
    }),
    false,
  );
});
test('a legal and early 8-ball shot complete through the physical solver', () => {
  for (const legal of [true, false]) {
    const w = worldPool(eightFixture(legal));
    assert.ok(validPool(w.state));
    assert.ok(shootPool(w));
    physicsFinish(w);
    assert.equal(w.winner, legal ? 0 : 1);
    assert.equal(w.balls.find((b) => b.number === 8)?.pocketed, true);
  }
});
test('scratch, group assignment, wrong-first-ball and turn retention match house rules', () => {
  const w = worldPool(newPool('1'));
  w.shot = {
    firstHit: 1,
    railAfterHit: false,
    pocketed: [1],
    remainingBefore: 7,
  };
  w.rolling = true;
  assert.match(finishPoolShot(w), /shoot again/);
  assert.deepEqual(w.state.assignments, ['solids', 'stripes']);
  assert.equal(w.state.player, 0);
  w.shot = {
    firstHit: 9,
    railAfterHit: true,
    pocketed: [],
    remainingBefore: 6,
  };
  assert.match(finishPoolShot(w), /Wrong ball contacted first/);
  assert.equal(w.state.player, 1);
  w.balls[0].pocketed = true;
  w.shot = {
    firstHit: 9,
    railAfterHit: true,
    pocketed: [0],
    remainingBefore: 7,
  };
  assert.match(finishPoolShot(w), /scratched/);
  assert.equal(w.balls[0].pocketed, false);
  assert.equal(w.state.player, 0);
});
