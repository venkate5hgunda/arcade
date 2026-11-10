export function localDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function dailySeed(date: string) {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
}
export function edition(mode = 'daily', now = new Date()) {
  const date = mode === 'practice' ? null : localDate(now);
  return {
    date,
    seed: date ? dailySeed(date) : Math.floor(Math.random() * 0x7fffffff),
  };
}
export function validEdition(s: { seed: number; date: string | null }) {
  return (
    Number.isSafeInteger(s.seed) &&
    s.seed >= 0 &&
    s.seed < 0x80000000 &&
    (s.date === null ||
      (typeof s.date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(s.date) &&
        Number.isFinite(Date.parse(`${s.date}T00:00:00Z`)) &&
        new Date(`${s.date}T00:00:00Z`).toISOString().slice(0, 10) === s.date &&
        dailySeed(s.date) === s.seed))
  );
}
export function randomFor(seed: number) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 0x100000000;
  };
}
export function shuffle<T>(values: T[], random: () => number) {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export const int = (v: unknown, min: number, max: number): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
export const unique = (a: unknown[]) => new Set(a).size === a.length;
