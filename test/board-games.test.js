import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACK, legalMoves } from '../games/ludo.js';
import { createBoardLayout, squareCenter, boardArt, snakeTravelPoints, ladderTravelPoints } from '../js/snakes-board.js';
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

test('ludo identifies forced moves without changing multiple or no-move rolls', () => {
  assert.deepEqual(legalMoves([-1, 55, 58, 58], 3), [1]);
  assert.deepEqual(legalMoves([-1, 55, 58, 58], 2), [1]);
  assert.deepEqual(legalMoves([-1, 58, 58, 58], 4), []);
  assert.deepEqual(legalMoves([-1, -1, 58, 58], 6), [0, 1]);
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

test('generated obstacle paths stay apart and travel reaches the illustrated endpoints', () => {
  const distance = (point, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
  };
  for (let seed = 0; seed < 250; seed++) {
    const { snakes, ladders } = createBoardLayout(`board-${seed}`);
    assert.equal(snakes.length, 5);
    assert.equal(ladders.length, 4);
    const giant = snakes.filter(({ start, end }) => start >= 95 && start < 100 && end < 50);
    assert.equal(giant.length, 1, `board ${seed}: missing giant snake`);
    assert.ok(boardArt({ snakes, ladders }).includes(`sl-art-snake-giant" data-head="${giant[0].start}"`));
    const paths = [
      ...snakes.map((obstacle) => [obstacle, snakeTravelPoints(obstacle)]),
      ...ladders.map((obstacle) => [obstacle, [squareCenter(obstacle.start), squareCenter(obstacle.end)]]),
    ];
    for (const [obstacle, points] of paths) {
      assert.deepEqual(points[0], squareCenter(obstacle.start));
      assert.deepEqual(points.at(-1), squareCenter(obstacle.end));
    }
    for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        const a = paths[i][1], b = paths[j][1];
        for (const point of a) {
          const closest = Math.min(...b.slice(1).map((end, index) => distance(point, b[index], end)));
          assert.ok(closest >= 31, `board ${seed}: obstacle ${i} meets ${j}`);
        }
        for (const point of b) {
          const closest = Math.min(...a.slice(1).map((end, index) => distance(point, a[index], end)));
          assert.ok(closest >= 31, `board ${seed}: obstacle ${j} meets ${i}`);
        }
      }
    }
    for (const ladder of ladders) {
      const climb = ladderTravelPoints(ladder);
      assert.deepEqual(climb[0], squareCenter(ladder.start));
      assert.deepEqual(climb.at(-1), squareCenter(ladder.end));
    }
  }
});

test('dice have six numbered 3D faces and semantic roll control', () => {
  const markup = dieMarkup(4);
  assert.equal((markup.match(/arcade-die-face-\d/g) || []).length, 6);
  assert.ok(markup.includes('arcade-die-arena'));
});
