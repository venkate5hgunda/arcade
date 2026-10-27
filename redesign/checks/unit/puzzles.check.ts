import test from 'node:test';
import assert from 'node:assert/strict';
import {
  c4Drop,
  c4Win,
  c4AI,
  c4Row,
  validC4,
  tileMove,
  tileSpawn,
  tileHasMoves,
  validTiles,
  mineInitial,
  mineReveal,
  neighbors,
  validMines,
  memoryInitial,
  memoryFlip,
  memoryHide,
  validMemory,
  validSimon,
  simonPress,
} from '../../src/lib/puzzles.ts';
import type { MemoryState } from '../../src/lib/puzzles.ts';
import type { LocalState } from '../../src/lib/tictactoe.ts';

test('Connect Four applies gravity, detects a real win and rejects full columns and terminal moves', () => {
  let s: LocalState = { mode: 'pvp', board: Array(42).fill(0), current: 1 };
  for (const col of [0, 1, 0, 1, 0, 1, 0]) {
    s = c4Drop(s, col);
    assert.ok(validC4(s, !!s.over));
  }
  assert.deepEqual(c4Win(s.board), [14, 21, 28, 35]);
  assert.equal(s.current, 1);
  assert.equal(s.over, true);
  assert.throws(() => c4Drop(s, 2));
  assert.equal(validC4(s), false);
  let full: LocalState = { mode: 'pvp', board: Array(42).fill(0), current: 1 };
  for (let i = 0; i < 6; i++) full = c4Drop(full, 2);
  assert.equal(c4Row(full.board, 2), -1);
  assert.throws(() => c4Drop(full, 2));
  const floating = { mode: 'pvp', board: Array(42).fill(0), current: 2 };
  floating.board[0] = 1;
  assert.equal(validC4(floating), false);
});
test('Connect Four AI takes wins and blocks immediate losses without mutating the board', () => {
  const b = Array(42).fill(0);
  b[35] = b[36] = b[37] = 2;
  assert.equal(c4AI(b), 3);
  assert.equal(b[38], 0);
  b[35] = b[36] = b[37] = 1;
  assert.equal(c4AI(b), 3);
});
test('2048 typed merge results match the original engine in every direction, including chained pairs', async () => {
  const { resolve } = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const original = await import(
    pathToFileURL(resolve('../games/2048.js')).href
  );
  for (const grid of [
    [
      [2, 2, 2, 2],
      [4, 0, 4, 4],
      [0, 2, 0, 2],
      [8, 8, 16, 0],
    ],
    [
      [0, 0, 0, 0],
      [2, 4, 8, 16],
      [2, 4, 8, 16],
      [2, 4, 8, 16],
    ],
  ])
    for (const direction of ['left', 'right', 'up', 'down'] as const) {
      const before = structuredClone(grid);
      const result = tileMove(grid, direction),
        expected = original.move(grid, direction);
      assert.deepEqual(result.grid, expected.grid);
      assert.equal(result.gained, expected.gained);
      assert.deepEqual(grid, before);
    }
  assert.deepEqual(
    tileMove(
      [
        [2, 2, 2, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      'left',
    ).grid[0],
    [4, 4, 0, 0],
  );
  const dead = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
  ];
  assert.equal(tileHasMoves(dead), false);
  assert.equal(
    validTiles({ grid: dead, score: 0, won: false, keepPlaying: false }),
    false,
  );
  assert.equal(
    tileSpawn(
      Array.from({ length: 4 }, () => Array(4).fill(0)),
      () => 0,
    )[0][0],
    2,
  );
});
test('Minesweeper preserves safe first neighborhood, preflags, counts, loss and complete win', () => {
  let s = mineInitial('easy');
  s = mineReveal(s, 0, true);
  s = mineReveal(s, 40, false, () => 0.31);
  assert.equal(s.board[0].flagged, true);
  assert.ok([40, ...neighbors(40, 9, 9)].every((n) => !s.board[n].mine));
  assert.ok(validMines(s));
  const loss = mineReveal(
    s,
    s.board.findIndex((c) => c.mine && !c.flagged),
  );
  assert.equal(loss.over, true);
  assert.equal(loss.won, false);
  assert.equal(validMines(loss), false);
  s = mineReveal(s, 0, true);
  for (let i = 0; i < s.board.length; i++)
    if (!s.board[i].mine) s = mineReveal(s, i);
  assert.equal(s.over, true);
  assert.equal(s.won, true);
  assert.equal(validMines(s), false);
  const corrupt = mineReveal(mineInitial('easy'), 40, false, () => 0.31);
  const n = corrupt.board.findIndex((c) => !c.mine);
  corrupt.board[n].count = 8;
  assert.equal(validMines(corrupt), false);
});
test('Memory mismatch hands off, matches retain turns, complete decks finish and malformed pairs are rejected', () => {
  let s = memoryInitial('4', '2', () => 0.999);
  assert.ok(validMemory(s));
  s = memoryFlip(s, 0).state;
  assert.ok(validMemory(s));
  let result = memoryFlip(s, 2);
  assert.deepEqual(result.mismatch, [0, 2]);
  assert.equal(validMemory(result.state), false);
  s = memoryHide(result.state, result.mismatch!);
  assert.equal(s.current, 2);
  assert.ok(validMemory(s));
  s = memoryFlip(memoryFlip(s, 0).state, 1).state;
  assert.equal(s.current, 2);
  assert.equal(s.scores[2], 1);
  for (let i = 2; i < 16; i += 2)
    s = memoryFlip(memoryFlip(s, i).state, i + 1).state;
  assert.equal(s.over, true);
  assert.equal(s.scores[2], 8);
  assert.equal(validMemory(s), false);
  const corrupt = memoryInitial('4', '1', () => 0.999);
  corrupt.cards[0].symbol = 'unexpected';
  assert.equal(validMemory(corrupt), false);
});
test('Simon accepts partial checkpoints and completed rounds, rejects malformed sequences, and ends on a wrong pad', () => {
  const s = { speed: 'normal' as const, sequence: [0, 2], playerStep: 0 };
  assert.ok(validSimon(s));
  const step = simonPress(s, 0);
  assert.equal(step.playerStep, 1);
  assert.ok(validSimon(step));
  assert.equal(simonPress(step, 2).playerStep, 2);
  assert.equal(simonPress(step, 1).over, true);
  assert.equal(validSimon({ ...s, sequence: [4] }), false);
  assert.equal(validSimon({ ...s, playerStep: 3 }), false);
});
