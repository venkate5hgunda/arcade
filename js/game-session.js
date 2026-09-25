import { KEYS, loadJSON, remove, saveJSON } from './storage.js';

const MINUTE = 60_000;
export const RESUME_MINUTES = Object.freeze({
  '2048': 20,
  'air-hockey': 10,
  blackjack: 5,
  catan: 120,
  chess: 45,
  'connect-four': 12,
  'crazy-eights': 15,
  'dumb-charades': 5,
  hangman: 10,
  imposter: 15,
  ludo: 30,
  memory: 12,
  minesweeper: 15,
  pool: 15,
  rps: 3,
  simon: 5,
  'snakes-ladders': 20,
  tictactoe: 8,
  uno: 20,
  'whack-a-mole': 2,
  'word-scramble': 10,
});

function sessions() {
  const value = loadJSON(KEYS.GAME_SESSIONS, {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function expired(id, entry, now) {
  return !Object.hasOwn(RESUME_MINUTES, id) || !entry ||
    typeof entry !== 'object' || !entry.state || typeof entry.state !== 'object' ||
    Array.isArray(entry.state) || !Number.isFinite(entry.savedAt) ||
    entry.savedAt > now || now - entry.savedAt >= RESUME_MINUTES[id] * MINUTE ||
    (id === 'whack-a-mole' && (!Number.isFinite(entry.state.deadline) || entry.state.deadline <= now));
}

function liveSessions(now = Date.now()) {
  const saved = sessions();
  let changed = false;
  for (const [id, entry] of Object.entries(saved)) {
    if (!expired(id, entry, now)) continue;
    delete saved[id];
    changed = true;
  }
  if (changed) {
    if (Object.keys(saved).length) saveJSON(KEYS.GAME_SESSIONS, saved);
    else remove(KEYS.GAME_SESSIONS);
  }
  return saved;
}

export function recentUnfinishedGame(now = Date.now()) {
  const saved = liveSessions(now);
  return Object.entries(saved).reverse().sort((a, b) => b[1].savedAt - a[1].savedAt)[0]?.[0] ?? null;
}

export function createGameSession(id) {
  if (!Object.hasOwn(RESUME_MINUTES, id)) throw new Error(`Unknown game session: ${id}`);
  const state = liveSessions()[id]?.state ?? null;
  let stopped = false;
  return {
    state,
    save(snapshot) {
      if (stopped) return;
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot))
        throw new TypeError('Game checkpoint must be an object.');
      const saved = liveSessions();
      delete saved[id];
      saved[id] = { state: snapshot, savedAt: Date.now() };
      if (!saveJSON(KEYS.GAME_SESSIONS, saved)) console.warn(`Could not save ${id} game progress.`);
    },
    finish() {
      if (stopped) return;
      const saved = sessions();
      if (Object.hasOwn(saved, id)) {
        delete saved[id];
        if (Object.keys(saved).length) saveJSON(KEYS.GAME_SESSIONS, saved);
        else remove(KEYS.GAME_SESSIONS);
      }
    },
    touch() {
      if (stopped) return;
      const saved = sessions();
      if (!expired(id, saved[id], Date.now())) {
        const state = saved[id].state;
        delete saved[id];
        saved[id] = { state, savedAt: Date.now() };
        if (!saveJSON(KEYS.GAME_SESSIONS, saved)) console.warn(`Could not save ${id} game activity.`);
      }
    },
    isExpired() {
      const entry = sessions()[id];
      return !!entry && expired(id, entry, Date.now());
    },
    stop() { stopped = true; },
  };
}
