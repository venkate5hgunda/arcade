// Thin localStorage wrapper, ported from js/storage.js.
// All redesign state is namespaced under `arcade:` so it never collides with
// other apps on the same host. Tolerant of quota / private-mode failures:
// a failed save simply does not persist and never blocks an in-memory session.

const PREFIX = 'arcade:';

type FailureCallback = (operation: string, key: string, error: unknown) => void;

const callbacks = new Set<FailureCallback>();
const failedKeys = new Map<string, Map<string, unknown>>();

export function onStorageFailure(cb: FailureCallback) {
  callbacks.add(cb);
  for (const [key, operations] of failedKeys)
    for (const [operation, error] of operations) cb(operation, key, error);
  return () => {
    callbacks.delete(cb);
  };
}

function reportFailure(op: string, key: string, err: unknown) {
  console.warn(`Storage ${op} failed for ${key}:`, err);
  let operations = failedKeys.get(key);
  if (!operations) failedKeys.set(key, (operations = new Map()));
  if (operations.has(op)) return;
  operations.set(op, err);
  for (const callback of callbacks) {
    try {
      callback(op, key, err);
    } catch {
      /* UI callbacks cannot block play. */
    }
  }
}

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    failedKeys.delete(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch (err) {
    reportFailure('load', key, err);
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    failedKeys.delete(key);
    return true;
  } catch (err) {
    reportFailure('save', key, err);
    return false;
  }
}

export function remove(key: string): boolean {
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
  RECENT_GAMES: 'ui.recentGames',
  PLAYER_NAMES: 'players.names',
  HIGH_SCORES: 'scores.highScores',
  SETTINGS: 'game.settings',
} as const;

export type StorageKey = (typeof KEYS)[keyof typeof KEYS];
