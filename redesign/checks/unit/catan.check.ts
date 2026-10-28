import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  newCatan,
  actCatan,
  actTradeReply,
  canRoad,
  canSettle,
  catanView,
  validCatanCheckpoint,
} from '../../src/lib/catan-core.js';
import type { IslandAction } from '../../src/lib/catan-core.js';
import { validIslandMove, validIslandView } from '../../src/lib/catan.ts';

const random = (initial: number) => {
  let seed = initial;
  return () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
};
test('Island rules retain the original seeded board, opening order and private projections', async () => {
  const original = await import(
    pathToFileURL(resolve('../games/catan.js')).href
  );
  for (const count of [3, 4]) {
    const a = newCatan(count, random(517));
    const b = original.newCatan(count, random(517));
    assert.deepEqual(a, b);
    function move(action: IslandAction) {
      assert.equal(actCatan(a, action), true);
      assert.equal(original.actCatan(b, action), true);
      assert.deepEqual(a, b);
      assert.equal(validCatanCheckpoint(a), true);
    }
    for (const n of [6, 5, 4, 3].slice(0, count))
      move({ type: 'setup-roll', dice: [n, n] });
    while (a.phase.startsWith('setup')) {
      if (a.phase === 'setup-settlement')
        move({
          type: 'setup-settlement',
          vertex: a.buildings.findIndex((_, i) =>
            canSettle(a, a.current, i, true),
          ),
        });
      else
        move({
          type: 'setup-road',
          edge: a.roads.findIndex((_, i) => canRoad(a, a.current, i, true)),
        });
    }
    move({ type: 'roll', dice: [2, 3] });
    for (const state of [a, b]) {
      for (const [player, good] of [
        [0, 'timber'],
        [1, 'ore'],
      ] as const) {
        state.players[player].goods[good] += 3;
        state.bank[good] -= 3;
      }
    }
    move({ type: 'offer', to: 1, give: { timber: 2 }, want: { ore: 1 } });
    assert.equal(actTradeReply(a, { type: 'accept' }, 1), true);
    assert.equal(original.actTradeReply(b, { type: 'accept' }, 1), true);
    assert.deepEqual(a, b);
    move({ type: 'end' });
    move({ type: 'roll', dice: [2, 3] });
    move({ type: 'end' });
    move({ type: 'roll', dice: [2, 3] });
    move({ type: 'end' });
    for (let seat = 0; seat < count; seat++) {
      const view = catanView(a, seat);
      assert.deepEqual(view, original.catanView(b, seat));
      assert.equal(validIslandView(view, count), true);
      assert.equal('players' in view, false);
      assert.equal('deck' in view, false);
    }
  }
  assert.equal(validIslandMove({ type: 'roll', dice: [6, 6] }), false);
  assert.equal(validIslandMove({ type: 'roll' }), true);
});
