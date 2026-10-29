import { newCards, cardView, applyCards } from '../../src/lib/cards.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { localCue, roomCue } from '../../src/lib/game-feedback.ts';
import { applyMove, emptyBoard } from '../../src/lib/tictactoe.ts';
import type { LocalState } from '../../src/lib/tictactoe.ts';
import {
  memoryInitial,
  memoryFlip,
  simonPress,
  mineInitial,
  mineReveal,
  tileMove,
} from '../../src/lib/puzzles.ts';
import { newBlackjack, actBlackjack } from '../../src/lib/blackjack.ts';
import { createHangman, guessHangman } from '../../src/lib/hangman.ts';
import { newRace, applyRace } from '../../src/lib/races.ts';
import type { RoomSnapshot } from '../../src/lib/room/protocol.ts';
import { recordStanding } from '../../src/lib/room/standings.ts';

test('accepted game transitions distinguish moves, human wins, losses, draws and correct puzzle answers', () => {
  let state: LocalState = {
    mode: 'ai',
    board: emptyBoard(),
    current: 1,
    over: false,
  };
  for (const cell of [0, 3, 1, 4]) {
    const result = applyMove(state.board, state.current, cell);
    state = {
      mode: 'ai',
      board: result.board,
      current: result.current,
      over: result.finished,
    };
  }
  const win = applyMove(state.board, state.current, 2);
  const result: LocalState = {
    mode: 'ai',
    board: win.board,
    current: win.current,
    over: win.finished,
  };
  assert.equal(localCue('tictactoe', state, result)?.sound, 'chime');
  const lossStart: LocalState = {
    mode: 'ai',
    board: [1, 1, 0, 2, 2, 0, 0, 0, 1],
    current: 2,
    over: false,
  };
  const lost = applyMove(lossStart.board, lossStart.current, 5);
  assert.equal(
    localCue('tictactoe', lossStart, {
      mode: 'ai',
      board: lost.board,
      current: lost.current,
      over: lost.finished,
    })?.sound,
    'buzz',
  );
  const drawStart: LocalState = {
    mode: 'pvp',
    board: [1, 2, 1, 1, 2, 2, 2, 1, 0],
    current: 1,
    over: false,
  };
  const drawn = applyMove(drawStart.board, drawStart.current, 8);
  assert.equal(
    localCue('tictactoe', drawStart, {
      mode: 'pvp',
      board: drawn.board,
      current: drawn.current,
      over: drawn.finished,
    })?.sound,
    'tickLow',
  );
  assert.equal(localCue('tictactoe', result, result), null);
  let memory = memoryInitial('4', '1', () => 0.5);
  const first = memory.cards[0],
    second = memory.cards.findIndex(
      (c, i) => i > 0 && c.symbol === first.symbol,
    );
  memory = memoryFlip(memory, 0).state;
  assert.equal(
    localCue('memory', memory, memoryFlip(memory, second).state)?.sound,
    'chime',
  );
  const simon = { speed: 'normal' as const, sequence: [1], playerStep: 0 };
  assert.equal(localCue('simon', simon, simonPress(simon, 1))?.sound, 'chime');
  assert.equal(localCue('simon', simon, simonPress(simon, 2))?.sound, 'buzzer');
  let mine = mineInitial('easy');
  mine = mineReveal(mine, 40);
  const bomb = mine.board.findIndex((c) => c.mine);
  assert.equal(
    localCue('minesweeper', mine, mineReveal(mine, bomb))?.sound,
    'buzz',
  );
  const tiles = {
    grid: [
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    score: 0,
    won: false,
    keepPlaying: false,
  };
  const merged = tileMove(tiles.grid, 'left');
  assert.equal(
    localCue('2048', tiles, {
      ...tiles,
      grid: merged.grid,
      score: merged.gained,
    })?.sound,
    'pop',
  );
  const hangman = {
    ...createHangman('1'),
    word: 'ARCADE',
    guessed: [],
    wrong: 0,
  };
  assert.equal(
    localCue('hangman', hangman, guessHangman(hangman, 'A').state)?.sound,
    'pop',
  );
  assert.equal(
    localCue('hangman', hangman, guessHangman(hangman, 'Z').state)?.sound,
    'buzz',
  );
  const race = newRace('snakes-ladders', 2, 'demo');
  const moved = applyRace(race, { type: 'roll' }, 0, () => 0)!;
  assert.equal(
    localCue('snakes-ladders', race.state, moved.state)?.sound,
    'rattle',
  );
  let blackjack = newBlackjack(null, () => 0.5);
  blackjack = { ...blackjack, result: null };
  const settled = actBlackjack(blackjack, 'stand');
  assert.equal(
    localCue('blackjack', blackjack, settled)?.sound,
    settled.result === 'win'
      ? 'chime'
      : settled.result === 'loss'
        ? 'buzz'
        : 'tickLow',
  );
});

test('room recipients celebrate their own result and never another seat or a duplicate snapshot', () => {
  const ids = ['mira', 'kai'];
  const a: RoomSnapshot = {
    roomId: 'test',
    members: ids.map((id) => ({ id, name: id, connected: true })),
    spectators: [{ id: 'watcher', name: 'Watcher', connected: true }],
    spectatorWins: [0],
    wins: [0, 0],
    draws: 0,
    standings: { players: [], recorded: [] },
    match: {
      mode: 'pvp',
      board: emptyBoard(),
      current: 1,
      over: false,
      round: 0,
      revision: 0,
    },
  };
  const b = structuredClone(a);
  b.match!.revision = 1;
  b.match!.over = true;
  b.standings = recordStanding(a.standings!, ids, 'tictactoe', 0, [1]);
  assert.equal(roomCue(a, b, 'mira')?.sound, 'buzz');
  assert.equal(roomCue(a, b, 'kai')?.sound, 'chime');
  assert.notEqual(roomCue(a, b, 'watcher')?.sound, 'chime');
  assert.equal(roomCue(b, b, 'kai'), null);
  assert.equal(roomCue(null, b, 'kai'), null);
  b.match!.round++;
  assert.equal(roomCue(a, b, 'kai'), null);
});

test('card feedback consumes the raw local checkpoint used by the production card controller', () => {
  for (const game of ['crazy-eights', 'uno'] as const) {
    const before = newCards(game, 2, () => 0.5);
    const view = cardView(before, before.state.current);
    const action = view.legal.length
      ? game === 'uno'
        ? { type: 'play', id: Number(view.legal[0]), color: 'red' }
        : { type: 'play', id: view.legal[0] }
      : { type: 'draw' };
    const after = applyCards(before, action, before.state.current, () => 0.5);
    assert.ok(after);
    assert.ok(localCue(game, before.state, after.state));
  }
});
