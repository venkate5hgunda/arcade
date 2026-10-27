export interface WhackState {
  duration: string;
  score: number;
  misses: number;
  deadline: number;
}
export function validWhack(
  value: unknown,
  now = Date.now(),
): value is WhackState {
  const s = value as WhackState;
  return (
    !!s &&
    typeof s === 'object' &&
    !Array.isArray(s) &&
    ['30', '45', '60'].includes(s.duration) &&
    Number.isSafeInteger(s.score) &&
    s.score >= 0 &&
    Number.isSafeInteger(s.misses) &&
    s.misses >= 0 &&
    Number.isSafeInteger(s.deadline) &&
    s.deadline > 0 &&
    s.deadline <= now + Number(s.duration) * 1000
  );
}
export function newWhack(duration: string, now = Date.now()): WhackState {
  if (!['30', '45', '60'].includes(duration))
    throw new RangeError('Choose 30, 45 or 60 seconds.');
  return {
    duration,
    score: 0,
    misses: 0,
    deadline: now + Number(duration) * 1000,
  };
}
