// Local game-session persistence, ported from js/game-session.js.
// Each local session is `{ state, savedAt }` with a per-game expiry; timed
// games (whack-a-mole) retain an absolute deadline that survives reload.
// Finished or expired rounds are pruned and never resurrected.

import {
  KEYS,
  loadJSON,
  remove,
  saveJSON,
  reportFailure,
  withStorageLock,
} from './storage.ts';

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

// Shared by frame/canvas sessions in this page; another tab keeps its own expectation.
const known = new Map<string, string>();
const token = (entry: SessionEntry | undefined) =>
  JSON.stringify(entry ?? null);
function prune(saved: Sessions, now: number) {
  const removed: [string, string][] = [];
  for (const [id, entry] of Object.entries(saved))
    if (isExpired(id, entry, now)) {
      removed.push([id, token(entry)]);
      delete saved[id];
    }
  return removed;
}
function persist(saved: Sessions, removed: [string, string][] = []) {
  const ok = Object.keys(saved).length
    ? saveJSON(KEYS.GAME_SESSIONS, saved)
    : remove(KEYS.GAME_SESSIONS);
  if (ok)
    for (const [id, before] of removed)
      if (known.get(id) === before) known.set(id, 'null');
  return ok;
}
function liveSessions(now?: number): Sessions {
  const saved = sessions();
  const observedAt = now ?? Date.now();
  if (prune(saved, observedAt).length)
    void withStorageLock(KEYS.GAME_SESSIONS, () => {
      const fresh = sessions(),
        removed = prune(fresh, Math.max(observedAt, Date.now()));
      if (removed.length) persist(fresh, removed);
    });
  return saved;
}
function change(
  id: string,
  edit: (saved: Sessions) => void,
): Promise<boolean | undefined> {
  return withStorageLock(KEYS.GAME_SESSIONS, () => {
    const saved = sessions(),
      actual = token(saved[id]),
      expected = known.get(id);
    if (expected !== undefined && actual !== expected) {
      // An expired entry may have been pruned elsewhere; an active newer save must win.
      const expired =
        actual === 'null' &&
        isExpired(id, JSON.parse(expected) as SessionEntry, Date.now());
      if (!expired) {
        reportFailure(
          'conflict',
          KEYS.GAME_SESSIONS,
          new Error('Newer progress exists in another tab.'),
        );
        return false;
      }
    }
    const removed = prune(saved, Date.now());
    edit(saved);
    const ok = persist(saved, removed);
    if (ok) known.set(id, token(saved[id]));
    return ok;
  });
}
export function unfinishedGames(now?: number): string[] {
  return Object.entries(liveSessions(now))
    .reverse()
    .sort((a, b) => b[1].savedAt - a[1].savedAt)
    .map(([id]) => id);
}
export function recentUnfinishedGame(now?: number): string | null {
  return unfinishedGames(now)[0] ?? null;
}
export function deleteGameSession(id: string): Promise<boolean | undefined> {
  if (!known.has(id)) known.set(id, token(sessions()[id]));
  return change(id, (saved) => {
    delete saved[id];
  });
}
export interface GameSession {
  state: object | null;
  save(snapshot: object): Promise<void>;
  finish(): Promise<void>;
  touch(): void;
  isExpired(): boolean;
  stop(): void;
}
export function createGameSession(
  id: string,
  options: { fresh?: boolean } = {},
): GameSession {
  if (!Object.hasOwn(RESUME_MINUTES, id))
    throw new Error(`Unknown game session: ${id}`);
  const initial = sessions();
  if (options.fresh || !known.has(id)) known.set(id, token(initial[id]));
  const state = liveSessions()[id]?.state ?? null;
  let stopped = false;
  return {
    state,
    save(snapshot: object) {
      if (stopped) return Promise.resolve();
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot))
        throw new TypeError('Game checkpoint must be an object.');
      let frozen: object;
      try {
        frozen = JSON.parse(JSON.stringify(snapshot)) as object;
      } catch {
        reportFailure(
          'save',
          KEYS.GAME_SESSIONS,
          new Error('Checkpoint serialization unavailable.'),
        );
        return Promise.resolve();
      }
      return change(id, (saved) => {
        delete saved[id];
        saved[id] = { state: frozen, savedAt: Date.now() };
      }).then(() => undefined);
    },
    async finish() {
      if (!stopped)
        await change(id, (saved) => {
          delete saved[id];
        });
    },
    touch() {
      if (!stopped)
        void change(id, (saved) => {
          if (saved[id]) {
            const snapshot = saved[id].state;
            delete saved[id];
            saved[id] = { state: snapshot, savedAt: Date.now() };
          }
        });
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
