import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recordBest,
  bestScore,
  recordWin,
  localScores,
  markPlayed,
  recentGames,
} from '../../src/lib/profile.ts';
import { withStorageLock } from '../../src/lib/storage.ts';
const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  },
});
const queues = new Map<string, Promise<unknown>>();
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    locks: {
      request: <T>(key: string, change: () => T) => {
        const next = (queues.get(key) ?? Promise.resolve()).then(change);
        queues.set(
          key,
          next.catch(() => undefined),
        );
        return next;
      },
    },
  },
});
test('coordinated profile writes re-read under the lock and preserve maximums, other scores and distinct recent games', async () => {
  values.set(
    'arcade:scores.highScores',
    JSON.stringify({ chess: { Existing: 7 } }),
  );
  recordWin('Mira');
  recordWin('Mira');
  recordWin('Kai');
  await withStorageLock('scores.highScores', () => {});
  assert.deepEqual(localScores(), { Mira: 2, Kai: 1 });
  assert.deepEqual(JSON.parse(values.get('arcade:scores.highScores')!).chess, {
    Existing: 7,
  });
  await Promise.all([
    recordBest('2048', 128),
    recordBest('2048', 32),
    recordBest('2048', 64),
  ]);
  assert.equal(bestScore('2048'), 128);
  markPlayed('tictactoe');
  markPlayed('chess');
  markPlayed('tictactoe');
  await withStorageLock('ui.recentGames', () => {});
  assert.deepEqual(
    recentGames().map((value) => value.id),
    ['tictactoe', 'chess'],
  );
});

test('expiry cleanup never deletes a save written while another tab was reading its map', async () => {
  const { unfinishedGames } = await import('../../src/lib/session.ts');
  const realNow = Date.now;
  Date.now = () => 1001;
  try {
    const entry = {
      tictactoe: {
        state: { mode: 'pvp', board: [0, 0, 0, 0, 0, 0, 0, 0, 0], current: 1 },
        savedAt: 1001,
      },
    };
    values.set('arcade:game.sessions', JSON.stringify(entry));
    // A catalog scan started at 1000, before the other tab committed at 1001.
    unfinishedGames(1000);
    await withStorageLock('game.sessions', () => {});
    assert.deepEqual(JSON.parse(values.get('arcade:game.sessions')!), entry);
    assert.deepEqual(unfinishedGames(), ['tictactoe']);
  } finally {
    Date.now = realNow;
  }
});
