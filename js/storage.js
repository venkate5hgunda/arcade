// Thin localStorage wrapper — tolerates private-browsing / quota errors.
// All arcade state is namespaced under `arcade:` so it never collides with
// other apps on the same host.

const PREFIX = 'arcade:';

// Optional callback to surface storage failures (quota, private mode)
let storageFailureCallback = null;

export function onStorageFailure(cb) {
  storageFailureCallback = cb;
}

function reportFailure(op, key, err) {
  console.warn(`Storage ${op} failed for ${key}:`, err);
  if (storageFailureCallback) {
    try { storageFailureCallback(op, key, err); } catch { /* ignore callback errors */ }
  }
}

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (err) {
    reportFailure('load', key, err);
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (err) {
    reportFailure('save', key, err);
    return false; // storage full / disabled — fail silently, state just won't persist
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
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
