// Thin localStorage wrapper — tolerates private-browsing / quota errors.
// All arcade state is namespaced under `arcade:` so it never collides with
// other apps on the same host.

const PREFIX = 'arcade:';

// Optional callback to surface storage failures (quota, private mode)
let storageFailureCallback = null;
const failedKeys = new Map();

export function onStorageFailure(cb) {
  storageFailureCallback = cb;
  if (cb) {
    for (const [key, operations] of failedKeys) {
      for (const [operation, error] of operations) notifyFailure(cb, operation, key, error);
    }
  }
}

function notifyFailure(callback, op, key, err) {
  try { callback(op, key, err); } catch { /* ignore callback errors */ }
}

function reportFailure(op, key, err) {
  console.warn(`Storage ${op} failed for ${key}:`, err);
  let operations = failedKeys.get(key);
  if (!operations) failedKeys.set(key, operations = new Map());
  if (operations.has(op)) return;
  operations.set(op, err);
  if (storageFailureCallback) notifyFailure(storageFailureCallback, op, key, err);
}

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    failedKeys.delete(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (err) {
    reportFailure('load', key, err);
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    failedKeys.delete(key);
    return true;
  } catch (err) {
    reportFailure('save', key, err);
    return false; // storage full / disabled — fail silently, state just won't persist
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
    failedKeys.delete(key);
    return true;
  } catch (err) {
    reportFailure('remove', key, err);
    return false;
  }
}

export const KEYS = {
  THEME: 'ui.theme',
  SOUND_ENABLED: 'ui.soundEnabled',
  HAPTICS_ENABLED: 'ui.hapticsEnabled',
  ACTIVE_GAME: 'ui.activeGame',
  GAME_SESSIONS: 'game.sessions',
  RECENT_GAMES: 'ui.recentGames', // [{ id, at }] most-recent-first, capped list
  PLAYER_NAMES: 'players.names',
  HIGH_SCORES: 'scores.highScores', // { [gameId]: { [playerId]: number } }
  SETTINGS: 'game.settings', // per-game settings (e.g. board size, difficulty)
};
