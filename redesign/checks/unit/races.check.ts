import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  applyRace,
  legalMoves,
  newRace,
  validRace,
  validSnakes,
  wrapRace,
} from '../../src/lib/races.ts';
import { boardArt, createBoardLayout } from '../../src/lib/snakes-board.ts';
import { validCheckpoint } from '../../src/lib/checkpoints.ts';
import type { LudoState, RaceState, SnakesState } from '../../src/lib/races.ts';

const roll = (game: RaceState, die: number, actor = game.state.current) =>
  applyRace(game, { type: 'roll' }, actor, () => (die - 0.5) / 6);

test('seeded Snakes boards and artwork match the original, and Ludo legal moves match every original position and roll', async () => {
  const original = await import(
    pathToFileURL(resolve('../js/snakes-board.js')).href
  );
  const ludo = await import(pathToFileURL(resolve('../games/ludo.js')).href);
  for (const seed of ['demo', 'arcade', 'another-seed', '123456']) {
    const layout = createBoardLayout(seed);
    assert.deepEqual(layout, original.createBoardLayout(seed));
    assert.equal(boardArt(layout), original.boardArt(layout));
    assert.ok(layout.snakes.some((s) => s.start === 99 && s.end === 21));
  }
  for (let pos = -1; pos <= 58; pos++)
    for (let die = 1; die <= 6; die++)
      assert.deepEqual(
        legalMoves([pos, -1, 57, 58], die),
        ludo.legalMoves([pos, -1, 57, 58], die),
      );
});

test('Snakes restores legacy saves, slides, requires an exact finish, and rejects forged actions', () => {
  const game = newRace('snakes-ladders', 3, 'demo');
  assert.equal(game.gameId, 'snakes-ladders');
  if (game.gameId !== 'snakes-ladders') return;
  const old = { ...game.state } as Partial<SnakesState>;
  delete old.winner;
  assert.ok(validCheckpoint('snakes-ladders', old));
  assert.ok(validRace(wrapRace('snakes-ladders', old as SnakesState)));
  game.state.positions[0] = 98;
  const slide = roll(game, 1)!;
  assert.equal(slide.gameId, 'snakes-ladders');
  if (slide.gameId !== 'snakes-ladders') return;
  assert.equal(slide.state.positions[0], 21);
  assert.equal(slide.state.current, 1);
  game.state.positions[0] = 99;
  const over = roll(game, 2)!;
  assert.equal((over.state as SnakesState).positions[0], 99);
  assert.equal(over.state.current, 1);
  const won = roll(game, 1)!;
  assert.equal(won.state.winner, 0);
  assert.ok(validRace(won, true));
  assert.equal(validSnakes(won.state), false);
  assert.equal(applyRace(game, { type: 'roll', value: 1 }, 0), null);
  assert.equal(roll(game, 1, 1), null);
  assert.equal(applyRace(won, { type: 'roll' }, 0), null);
});

test('Ludo releases on six, chooses among tokens, captures, protects safe squares, and finishes exactly', () => {
  const game = newRace('ludo', 2);
  assert.equal(game.gameId, 'ludo');
  if (game.gameId !== 'ludo') return;
  let next = roll(game, 6)!;
  assert.equal(next.gameId, 'ludo');
  if (next.gameId !== 'ludo') return;
  assert.deepEqual(next.state.movable, [0, 1, 2, 3]);
  assert.equal(applyRace(next, { type: 'roll' }, 0), null);
  assert.equal(applyRace(next, { type: 'move', index: 5 }, 0), null);
  next = applyRace(next, { type: 'move', index: 0 }, 0)!;
  assert.equal((next.state as LudoState).tokens[0][0], 0);
  assert.equal(next.state.current, 0);
  const capture: LudoState = {
    ...game.state,
    tokens: [
      [13, -1, -1, -1],
      [1, -1, -1, -1],
    ],
    current: 0,
  };
  next = roll({ gameId: 'ludo', state: capture }, 1)!;
  assert.equal((next.state as LudoState).tokens[1][0], -1);
  assert.equal(next.state.current, 0);
  const safe: LudoState = {
    ...game.state,
    tokens: [
      [7, -1, -1, -1],
      [47, -1, -1, -1],
    ],
    current: 0,
  };
  next = roll({ gameId: 'ludo', state: safe }, 1)!;
  assert.equal((next.state as LudoState).tokens[1][0], 47);
  assert.equal(next.state.current, 1);
  const finish: LudoState = {
    ...game.state,
    tokens: [
      [57, 58, 58, 58],
      [-1, -1, -1, -1],
    ],
    current: 0,
  };
  const tooFar = roll({ gameId: 'ludo', state: finish }, 2)!;
  assert.equal(tooFar.state.current, 1);
  const won = roll({ gameId: 'ludo', state: finish }, 1)!;
  assert.equal(won.state.winner, 0);
  assert.ok(validRace(won, true));
  assert.equal(validCheckpoint('ludo', won.state), false);
});
