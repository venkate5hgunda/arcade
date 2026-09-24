import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameSession, recentUnfinishedGame, RESUME_MINUTES } from '../js/game-session.js';
import { KEYS, loadJSON, saveJSON } from '../js/storage.js';
import { GAMES } from '../js/game-catalog.js';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};

test('every game has its own inactivity window', () => {
  assert.deepEqual(Object.keys(RESUME_MINUTES).sort(), GAMES.map((game) => game.id).sort());
  assert.ok(new Set(Object.values(RESUME_MINUTES)).size > 4);
  assert.ok(Object.values(RESUME_MINUTES).every((minutes) => Number.isInteger(minutes) && minutes > 0));
});

test('only an unfinished checkpoint returns to its actual saved round', () => {
  values.clear();
  const session = createGameSession('chess');
  assert.equal(session.state, null);
  session.save({ board: ['pawn'], turn: 'w' });
  assert.equal(recentUnfinishedGame(), 'chess');
  assert.deepEqual(createGameSession('chess').state, { board: ['pawn'], turn: 'w' });
  session.finish();
  assert.equal(recentUnfinishedGame(), null);
  assert.equal(createGameSession('chess').state, null);
});

test('expired and malformed checkpoints are deleted without erasing fresh games', () => {
  values.clear();
  const now = Date.now();
  saveJSON(KEYS.GAME_SESSIONS, {
    blackjack: { state: { cards: [] }, savedAt: now - RESUME_MINUTES.blackjack * 60_000 },
    chess: { state: { turn: 'b' }, savedAt: now - 1000 },
    ludo: { state: [], savedAt: now },
    unknown: { state: { test: 1 }, savedAt: now },
  });
  assert.equal(recentUnfinishedGame(now), 'chess');
  assert.deepEqual(Object.keys(loadJSON(KEYS.GAME_SESSIONS, {})), ['chess']);
  assert.equal(createGameSession('blackjack').state, null);
});

test('the most recent unfinished game wins and leaving refreshes inactivity', () => {
  values.clear();
  const chess = createGameSession('chess');
  chess.save({ turn: 'w' });
  const cards = createGameSession('blackjack');
  cards.save({ turn: 1 });
  assert.equal(recentUnfinishedGame(), 'blackjack');
  const saved = loadJSON(KEYS.GAME_SESSIONS, {});
  saved.chess.savedAt = Date.now() - 30_000;
  saveJSON(KEYS.GAME_SESSIONS, saved);
  chess.touch();
  assert.equal(recentUnfinishedGame(), 'chess');
  chess.stop();
  chess.finish();
  assert.ok(createGameSession('chess').state);
});

test('expired games cannot be made fresh by touching them', () => {
  values.clear();
  const round = createGameSession('rps');
  round.save({ choice: 'rock' });
  const saved = loadJSON(KEYS.GAME_SESSIONS, {});
  saved.rps.savedAt -= RESUME_MINUTES.rps * 60_000;
  saveJSON(KEYS.GAME_SESSIONS, saved);
  assert.equal(round.isExpired(), true);
  round.touch();
  assert.equal(recentUnfinishedGame(), null);
});

test('a timed round cannot outlive its own clock even within its resume window', () => {
  values.clear();
  const now = Date.now();
  saveJSON(KEYS.GAME_SESSIONS, {
    'whack-a-mole': { state: { deadline: now - 1 }, savedAt: now - 1000 },
  });
  assert.equal(recentUnfinishedGame(now), null);
  assert.equal(loadJSON(KEYS.GAME_SESSIONS, null), null);
});

test('each catalog game expires at its own configured inactivity boundary', () => {
  values.clear();
  const now = Date.now();
  const saved = Object.fromEntries(GAMES.map(({ id }) => [id, {
    savedAt: now - RESUME_MINUTES[id] * 60_000,
    state: id === 'whack-a-mole' ? { deadline: now + 60_000 } : { inProgress: true },
  }]));
  saveJSON(KEYS.GAME_SESSIONS, saved);
  assert.equal(recentUnfinishedGame(now), null);
  assert.equal(loadJSON(KEYS.GAME_SESSIONS, null), null);
});
