// Local game-session persistence, ported from js/game-session.js.
// Each local session is `{ state, savedAt }` with a per-game expiry; timed
// games (whack-a-mole) retain an absolute deadline that survives reload.
// Finished or expired rounds are pruned and never resurrected.

import { KEYS, loadJSON, remove, saveJSON } from './storage.ts';

const MINUTE = 60_000;

export const RESUME_MINUTES = Object.freeze({
  '2048': 20,
  'show-star': 20,
  taboo: 15,
  wordle: 20,
  'air-hockey': 10,
  blackjack: 5,
  business: 240,
  catan: 120,
  chess: 45,
  'connect-four': 12,
  'crazy-eights': 15,
  'dumb-charades': 8,
  hangman: 10,
  imposter: 15,
  ludo: 30,
  mafia: 120,
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
} as const);

export interface SessionEntry {
  state: object;
  savedAt: number;
}
type Sessions = Record<string, SessionEntry>;

function sessions(): Sessions {
  const value = loadJSON<Sessions>(KEYS.GAME_SESSIONS, {});
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function isExpired(
  id: string,
  entry: SessionEntry | undefined,
  now: number,
): boolean {
  const lifetime = RESUME_MINUTES[id as keyof typeof RESUME_MINUTES];
  return (
    lifetime === undefined ||
    !entry ||
    typeof entry !== 'object' ||
    !entry.state ||
    typeof entry.state !== 'object' ||
    Array.isArray(entry.state) ||
    !Number.isFinite(entry.savedAt) ||
    entry.savedAt > now ||
    now - entry.savedAt >= lifetime * MINUTE ||
    (id === 'whack-a-mole' &&
      (!Number.isFinite((entry.state as { deadline?: number }).deadline) ||
        (entry.state as { deadline: number }).deadline <= now))
  );
}

function liveSessions(now = Date.now()): Sessions {
  const saved = sessions();
  let changed = false;
  for (const [id, entry] of Object.entries(saved)) {
    if (!isExpired(id, entry, now)) continue;
    delete saved[id];
    changed = true;
  }
  if (changed) {
    if (Object.keys(saved).length) saveJSON(KEYS.GAME_SESSIONS, saved);
    else remove(KEYS.GAME_SESSIONS);
  }
  return saved;
}

export function unfinishedGames(now = Date.now()): string[] {
  return Object.entries(liveSessions(now))
    .reverse()
    .sort((a, b) => b[1].savedAt - a[1].savedAt)
    .map(([id]) => id);
}

export function recentUnfinishedGame(now = Date.now()): string | null {
  return unfinishedGames(now)[0] ?? null;
}

export function deleteGameSession(id: string): boolean {
  const saved = sessions();
  if (!Object.hasOwn(saved, id)) return true;
  delete saved[id];
  if (!saveJSON(KEYS.GAME_SESSIONS, saved)) {
    console.warn(`Could not delete ${id} saved game.`);
    return false;
  }
  return true;
}

export interface GameSession {
  state: object | null;
  save(snapshot: object): void;
  finish(): void;
  touch(): void;
  isExpired(): boolean;
  stop(): void;
}

export function createGameSession(id: string): GameSession {
  if (!Object.hasOwn(RESUME_MINUTES, id))
    throw new Error(`Unknown game session: ${id}`);
  const state = liveSessions()[id]?.state ?? null;
  let stopped = false;
  return {
    state,
    save(snapshot: object) {
      if (stopped) return;
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot))
        throw new TypeError('Game checkpoint must be an object.');
      const saved = liveSessions();
      delete saved[id];
      saved[id] = { state: snapshot, savedAt: Date.now() };
      if (!saveJSON(KEYS.GAME_SESSIONS, saved))
        console.warn(`Could not save ${id} game progress.`);
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
      if (!isExpired(id, saved[id], Date.now())) {
        const snapshot = saved[id].state;
        delete saved[id];
        saved[id] = { state: snapshot, savedAt: Date.now() };
        if (!saveJSON(KEYS.GAME_SESSIONS, saved))
          console.warn(`Could not save ${id} game activity.`);
      }
    },
    isExpired() {
      const entry = sessions()[id];
      return !!entry && isExpired(id, entry, Date.now());
    },
    stop() {
      stopped = true;
    },
  };
}
