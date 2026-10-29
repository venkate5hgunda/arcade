import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMove,
  emptyBoard,
  findWin,
  isValidState,
  aiMove,
} from '../../src/lib/tictactoe.ts';
import { createGameSession, unfinishedGames } from '../../src/lib/session.ts';
import { KEYS, saveJSON, onStorageFailure } from '../../src/lib/storage.ts';
import {
  recentGames,
  markPlayed,
  localScores,
  recordWin,
  names,
} from '../../src/lib/profile.ts';

const data = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  },
});

test('real moves produce a legal win, reject extra moves and never mutate earlier boards', () => {
  let board = emptyBoard();
  const original = board;
  let current = 1;
  for (const cell of [0, 5, 6, 7, 3]) {
    const result = applyMove(board, current, cell);
    board = result.board;
    current = result.current;
  }
  assert.deepEqual(original, emptyBoard());
  assert.deepEqual(board, [1, 0, 0, 1, 0, 2, 1, 2, 0]);
  assert.deepEqual(findWin(board), [0, 3, 6]);
  assert.ok(isValidState({ mode: 'pvp', board, current, over: true }, true));
  assert.ok(!isValidState({ mode: 'pvp', board, current, over: true }));
  assert.throws(() => applyMove(board, current, 1), RangeError);
});

test('validation rejects contradictory flags, two winners, wrong turns and invalid cells', () => {
  assert.ok(
    !isValidState(
      { mode: 'pvp', board: emptyBoard(), current: 1, over: true },
      true,
    ),
  );
  assert.ok(
    !isValidState(
      {
        mode: 'pvp',
        board: [1, 1, 1, 2, 2, 2, 1, 0, 0],
        current: 1,
        over: true,
      },
      true,
    ),
  );
  assert.ok(
    !isValidState({
      mode: 'ai',
      board: [1, 0, 0, 0, 0, 0, 0, 0, 0],
      current: 1,
    }),
  );
  assert.throws(() => applyMove(emptyBoard(), 1, -1), RangeError);
  assert.throws(() => applyMove(emptyBoard(), 1, 1.5), RangeError);
  assert.throws(() => applyMove(emptyBoard(), 3, 0), RangeError);
});

test('every possible human line against the real AI ends in a draw or computer win', () => {
  let leaves = 0;
  function visit(board: ReturnType<typeof emptyBoard>) {
    for (let cell = 0; cell < 9; cell++) {
      if (board[cell]) continue;
      const human = applyMove(board, 1, cell);
      assert.equal(human.win, null, 'human must never beat perfect play');
      if (human.finished) {
        leaves++;
        continue;
      }
      const move = aiMove(human.board, 2, 1);
      const computer = applyMove(human.board, 2, move);
      if (computer.finished) leaves++;
      else visit(computer.board);
    }
  }
  visit(emptyBoard());
  assert.ok(leaves > 100);
});

test('sessions preserve baseline envelopes, prune expiry, and finish without damaging preferences', () => {
  data.clear();
  saveJSON(KEYS.PLAYER_NAMES, ['Mira', 'Kai']);
  const session = createGameSession('tictactoe');
  session.save({ mode: 'pvp', board: emptyBoard(), current: 1 });
  assert.deepEqual(unfinishedGames(), ['tictactoe']);
  assert.deepEqual(createGameSession('tictactoe').state, {
    mode: 'pvp',
    board: emptyBoard(),
    current: 1,
  });
  session.finish();
  assert.deepEqual(unfinishedGames(), []);
  assert.deepEqual(names(), ['Mira', 'Kai']);
  saveJSON(KEYS.GAME_SESSIONS, {
    tictactoe: { state: { board: [] }, savedAt: Date.now() - 9 * 60_000 },
    unknown: { state: {}, savedAt: Date.now() },
  });
  assert.deepEqual(unfinishedGames(), []);
});

test('recent entries and scores retain baseline shape and other game data', () => {
  data.clear();
  saveJSON(KEYS.RECENT_GAMES, [
    { id: 'wordle', at: 1 },
    { id: 'wordle', at: 1 },
    { id: 'missing', at: 2 },
  ]);
  markPlayed('tictactoe');
  markPlayed('tictactoe');
  assert.deepEqual(
    recentGames().map((e) => e.id),
    ['tictactoe', 'wordle'],
  );
  saveJSON(KEYS.HIGH_SCORES, { chess: { Mira: 3 }, tictactoe: { Kai: 1 } });
  recordWin('Mira');
  recordWin('Kai');
  assert.deepEqual(localScores(), { Kai: 2, Mira: 1 });
  assert.deepEqual(JSON.parse(data.get('arcade:scores.highScores')!).chess, {
    Mira: 3,
  });
  saveJSON(KEYS.PLAYER_NAMES, null);
  assert.deepEqual(names(), []);
  saveJSON(KEYS.RECENT_GAMES, {});
  assert.deepEqual(recentGames(), []);
});

test('storage quota errors notify the UI without blocking an in-memory round', () => {
  const previous = localStorage.setItem;
  let failures = 0;
  const unsubscribe = onStorageFailure(() => failures++);
  localStorage.setItem = () => {
    throw new Error('quota');
  };
  try {
    assert.equal(saveJSON('test.quota', {}), false);
    assert.equal(failures, 1);
    assert.equal(applyMove(emptyBoard(), 1, 0).board[0], 1);
  } finally {
    localStorage.setItem = previous;
    unsubscribe();
  }
});

test('all catalog identities, player limits, categories and icons match the original registry', async () => {
  const { pathToFileURL } = await import('node:url');
  const { resolve } = await import('node:path');
  const original = await import(
    pathToFileURL(resolve('../js/game-catalog.js')).href
  );
  const { GAMES } = await import('../../src/lib/games.ts');
  const shape = (g: (typeof GAMES)[number]) => ({
    id: g.id,
    name: g.name,
    players: g.players,
    category: g.category,
    icon: g.icon,
  });
  assert.deepEqual(GAMES.map(shape), original.GAMES.map(shape));
});
