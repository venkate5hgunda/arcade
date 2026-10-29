import { KEYS, loadJSON, saveJSON, withStorageLock } from './storage.ts';
import { GAMES } from './games.ts';
export function names(): string[] {
  const raw = loadJSON<unknown>(KEYS.PLAYER_NAMES, []);
  return Array.isArray(raw)
    ? raw
        .slice(0, 20)
        .map((v) => (typeof v === 'string' ? v.trim().slice(0, 24) : ''))
    : [];
}
export interface Recent {
  id: string;
  at: number;
}
export function recentGames(): Recent[] {
  const raw = loadJSON<unknown>(KEYS.RECENT_GAMES, []);
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw
    .filter(
      (v): v is Recent =>
        !!v &&
        typeof v === 'object' &&
        GAMES.some((g) => g.id === v.id) &&
        Number.isFinite(v.at) &&
        !seen.has(v.id) &&
        !!seen.add(v.id),
    )
    .slice(0, 8);
}
export function markPlayed(id: string) {
  void withStorageLock(KEYS.RECENT_GAMES, () =>
    saveJSON(
      KEYS.RECENT_GAMES,
      [
        { id, at: Date.now() },
        ...recentGames().filter((g) => g.id !== id),
      ].slice(0, 8),
    ),
  );
}
export function localScores(): Record<string, number> {
  const all = loadJSON<Record<string, unknown> | null>(KEYS.HIGH_SCORES, {});
  const scores =
    all && typeof all === 'object' && !Array.isArray(all)
      ? all.tictactoe
      : null;
  return scores && typeof scores === 'object' && !Array.isArray(scores)
    ? Object.fromEntries(
        Object.entries(scores).filter(
          ([, n]) => Number.isSafeInteger(n) && (n as number) >= 0,
        ),
      )
    : {};
}
export function recordWin(name: string): Record<string, number> {
  const scores = localScores();
  const optimistic = { ...scores, [name]: (scores[name] ?? 0) + 1 };
  void withStorageLock(KEYS.HIGH_SCORES, () => {
    const raw = loadJSON<unknown>(KEYS.HIGH_SCORES, {});
    const all =
      raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const latest = localScores();
    saveJSON(KEYS.HIGH_SCORES, {
      ...all,
      tictactoe: { ...latest, [name]: (latest[name] ?? 0) + 1 },
    });
  });
  return optimistic;
}

export function bestScore(id: string): number {
  const value = loadJSON<unknown>(`${KEYS.HIGH_SCORES}:${id}`, 0);
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}
export function recordBest(id: string, score: number) {
  return withStorageLock(`${KEYS.HIGH_SCORES}:${id}`, () => {
    const best = Math.max(bestScore(id), score);
    saveJSON(`${KEYS.HIGH_SCORES}:${id}`, best);
    return best;
  });
}
