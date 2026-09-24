import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACK } from '../games/ludo.js';
import { createBoardLayout, squareCenter, boardArt } from '../js/snakes-board.js';
import { dieMarkup } from '../js/dice.js';

test('ludo track is a continuous 52-square circuit with quarter-turn starts', () => {
  assert.equal(TRACK.length, 52);
  assert.equal(new Set(TRACK.map(([r, c]) => `${r},${c}`)).size, 52);
  TRACK.forEach(([row, col], index) => {
    const [nextRow, nextCol] = TRACK[(index + 1) % 52];
    assert.ok(Math.max(Math.abs(row - nextRow), Math.abs(col - nextCol)) === 1,
      `path break after ${index}`);
  });
  assert.deepEqual([TRACK[0], TRACK[13], TRACK[26], TRACK[39]], [[6, 1], [1, 8], [8, 13], [13, 6]]);
});

test('snakes and ladders vary but never overlap or reverse direction', () => {
  const layouts = new Set();
  for (let i = 0; i < 80; i++) {
    const layout = createBoardLayout();
    const endpoints = layout.snakes.concat(layout.ladders).flatMap(({ start, end }) => [start, end]);
    assert.equal(new Set(endpoints).size, endpoints.length);
    assert.ok(endpoints.every((number) => number > 1 && number < 100));
    assert.ok(layout.snakes.every(({ start, end }) => start > end));
    assert.ok(layout.ladders.every(({ start, end }) => start < end));
    assert.ok(boardArt(layout).includes('sl-art-snake'));
    layouts.add(JSON.stringify(endpoints));
  }
  assert.ok(layouts.size > 1);
  assert.deepEqual(createBoardLayout('shared-room-1'), createBoardLayout('shared-room-1'));
  assert.notDeepEqual(createBoardLayout('shared-room-1'), createBoardLayout('shared-room-2'));
  assert.deepEqual(squareCenter(1), { x: 50, y: 950 });
  assert.deepEqual(squareCenter(100), { x: 50, y: 50 });
});

test('dice have six numbered 3D faces and semantic roll control', () => {
  const markup = dieMarkup(4);
  assert.equal((markup.match(/arcade-die-face-\d/g) || []).length, 6);
  assert.ok(markup.includes('arcade-die-arena'));
});
