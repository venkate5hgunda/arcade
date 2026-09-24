import test from 'node:test';
import assert from 'node:assert/strict';
import { move } from '../games/2048.js';

test('2048 keeps source and destination positions through moves and merges', () => {
  const grid = [[2, 2, 2, 2], [0, 0, 0, 0], [4, 0, 4, 0], [0, 0, 0, 0]];
  const left = move(grid, 'left');
  assert.deepEqual(left.grid, [[4, 4, 0, 0], [0, 0, 0, 0], [8, 0, 0, 0], [0, 0, 0, 0]]);
  assert.equal(left.gained, 16);
  assert.deepEqual(left.merges, [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 2, c: 0 }]);
  assert.deepEqual(left.tiles.slice(0, 2), [
    { r: 0, c: 0, tr: 0, tc: 0, value: 2 },
    { r: 0, c: 1, tr: 0, tc: 0, value: 2 },
  ]);
  assert.deepEqual(move(grid, 'right').grid[0], [0, 0, 4, 4]);
  assert.deepEqual(grid[0], [2, 2, 2, 2], 'input must remain untouched');
  assert.deepEqual(move([[2, 0, 0, 0], [2, 0, 0, 0], [2, 0, 0, 0], [2, 0, 0, 0]], 'down').grid.map(row => row[0]), [0, 0, 4, 4]);
  assert.deepEqual(move([[2, 0, 0, 0], [2, 0, 0, 0], [2, 0, 0, 0], [2, 0, 0, 0]], 'up').grid.map(row => row[0]), [4, 4, 0, 0]);
  assert.throws(() => move(grid, 'diagonal'), RangeError);
});

test('2048 never merges a tile twice in one move', () => {
  const { grid, gained, merges } = move([[2, 2, 4, 0], [4, 4, 8, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'left');
  assert.deepEqual(grid[0], [4, 4, 0, 0]);
  assert.deepEqual(grid[1], [8, 8, 0, 0]);
  assert.equal(gained, 12);
  assert.equal(merges.length, 2);
});
