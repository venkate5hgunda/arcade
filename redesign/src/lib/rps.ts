export const THROWS = ['rock', 'paper', 'scissors'] as const;
export type Throw = (typeof THROWS)[number];
export const HANDS = { rock: '✊', paper: '✋', scissors: '✌️' };
export interface RpsState {
  mode: 'ai' | 'pvp';
  target: number;
  score: [number, number];
  round: number;
  p1Pick: Throw | null;
  p2Pick: Throw | null;
  phase: 'p1pick' | 'handoff' | 'p2pick' | 'countdown' | 'reveal';
  deadline: number;
}
export const isThrow = (s: unknown): s is Throw => THROWS.includes(s as Throw);
export function rpsWinner(a: Throw, b: Throw): number | null {
  return a === b
    ? null
    : (THROWS.indexOf(a) + 2) % 3 === THROWS.indexOf(b)
      ? 0
      : 1;
}
export const rpsDone = (s: RpsState) =>
  s.phase === 'reveal' && s.score.some((n) => n === s.target);
export function validRps(value: unknown, finished = false): value is RpsState {
  const s = value as RpsState;
  if (
    !s ||
    !['ai', 'pvp'].includes(s.mode) ||
    ![3, 5, 7].includes(s.target) ||
    !Array.isArray(s.score) ||
    s.score.length !== 2 ||
    !s.score.every((n) => Number.isSafeInteger(n) && n >= 0 && n <= s.target) ||
    !Number.isSafeInteger(s.round) ||
    s.round < s.score[0] + s.score[1] ||
    !Number.isFinite(s.deadline) ||
    s.deadline < 0 ||
    !(s.p1Pick === null || isThrow(s.p1Pick)) ||
    !(s.p2Pick === null || isThrow(s.p2Pick))
  )
    return false;
  const phaseValid =
    s.phase === 'p1pick'
      ? s.p1Pick === null && s.p2Pick === null
      : s.phase === 'handoff' || s.phase === 'p2pick'
        ? s.mode === 'pvp' && s.p1Pick !== null && s.p2Pick === null
        : s.phase === 'countdown'
          ? s.p1Pick !== null && s.p2Pick !== null && s.deadline > 0
          : s.phase === 'reveal' &&
            s.p1Pick !== null &&
            s.p2Pick !== null &&
            s.round > 0;
  return (
    phaseValid &&
    (finished || !s.score.some((n) => n === s.target)) &&
    (!s.score.some((n) => n === s.target) || rpsDone(s))
  );
}
export function newRps(mode: 'ai' | 'pvp', target: number): RpsState {
  return {
    mode,
    target,
    score: [0, 0],
    round: 0,
    p1Pick: null,
    p2Pick: null,
    phase: 'p1pick',
    deadline: 0,
  };
}
export function pickRps(
  s: RpsState,
  pick: Throw,
  now = Date.now(),
  random = Math.random,
): RpsState {
  if (!isThrow(pick) || !['p1pick', 'p2pick'].includes(s.phase)) return s;
  if (s.phase === 'p1pick' && s.mode === 'pvp')
    return { ...s, p1Pick: pick, phase: 'handoff' };
  return {
    ...s,
    p1Pick: s.phase === 'p1pick' ? pick : s.p1Pick,
    p2Pick: s.mode === 'ai' ? THROWS[Math.floor(random() * 3)] : pick,
    phase: 'countdown',
    deadline: now + 2240,
  };
}
export function revealRps(s: RpsState, now = Date.now()): RpsState {
  if (s.phase !== 'countdown' || now < s.deadline || !s.p1Pick || !s.p2Pick)
    return s;
  const winner = rpsWinner(s.p1Pick, s.p2Pick),
    score: [number, number] = [...s.score];
  if (winner !== null) score[winner]++;
  return { ...s, score, round: s.round + 1, phase: 'reveal', deadline: 0 };
}
export function nextRps(s: RpsState): RpsState {
  return s.phase !== 'reveal' || rpsDone(s)
    ? s
    : { ...s, p1Pick: null, p2Pick: null, phase: 'p1pick', deadline: 0 };
}

export interface RpsRoomState {
  picks: [Throw | null, Throw | null];
  score: [number, number];
  turns: number;
  phase: 'picking' | 'countdown' | 'reveal';
  deadline: number;
}
export interface RpsView extends Omit<RpsRoomState, 'picks'> {
  seat: number;
  ownPick: Throw | null;
  locked: [boolean, boolean];
  revealed: [Throw, Throw] | null;
}
export const newRpsRoom = (): RpsRoomState => ({
  picks: [null, null],
  score: [0, 0],
  turns: 0,
  phase: 'picking',
  deadline: 0,
});
export const rpsRoomDone = (s: Pick<RpsRoomState, 'score' | 'phase'>) =>
  s.phase === 'reveal' && s.score.includes(3);
export function validRpsView(value: unknown): value is RpsView {
  const s = value as RpsView;
  return (
    !!s &&
    Object.keys(s).length === 8 &&
    Object.keys(s).every((k) =>
      [
        'seat',
        'ownPick',
        'locked',
        'revealed',
        'score',
        'turns',
        'phase',
        'deadline',
      ].includes(k),
    ) &&
    [-1, 0, 1].includes(s.seat) &&
    (s.ownPick === null || isThrow(s.ownPick)) &&
    Array.isArray(s.locked) &&
    s.locked.length === 2 &&
    s.locked.every((n) => typeof n === 'boolean') &&
    (s.seat === -1
      ? s.ownPick === null
      : s.locked[s.seat] === (s.ownPick !== null)) &&
    Array.isArray(s.score) &&
    s.score.length === 2 &&
    s.score.every((n) => Number.isSafeInteger(n) && n >= 0 && n <= 3) &&
    Number.isSafeInteger(s.turns) &&
    s.turns >= s.score[0] + s.score[1] &&
    s.score.filter((n) => n === 3).length <= 1 &&
    Number.isFinite(s.deadline) &&
    s.deadline >= 0 &&
    (s.phase === 'picking'
      ? !s.locked.every(Boolean) &&
        s.revealed === null &&
        s.deadline === 0 &&
        !s.score.includes(3)
      : s.phase === 'countdown'
        ? s.locked.every(Boolean) &&
          s.revealed === null &&
          s.deadline > 0 &&
          !s.score.includes(3)
        : s.phase === 'reveal' &&
          s.locked.every(Boolean) &&
          Array.isArray(s.revealed) &&
          s.revealed.length === 2 &&
          s.revealed.every(isThrow) &&
          (s.seat === -1 || s.revealed[s.seat] === s.ownPick) &&
          s.deadline === 0 &&
          s.turns > 0)
  );
}
export function rpsView(s: RpsRoomState, seat: number): RpsView {
  return {
    seat,
    ownPick: seat === -1 ? null : s.picks[seat],
    locked: [s.picks[0] !== null, s.picks[1] !== null],
    revealed: s.phase === 'reveal' ? (s.picks as [Throw, Throw]) : null,
    score: [...s.score],
    turns: s.turns,
    phase: s.phase,
    deadline: s.deadline,
  };
}
export function validRpsRoom(value: unknown): value is RpsRoomState {
  const s = value as RpsRoomState;
  return (
    !!s &&
    Object.keys(s).length === 5 &&
    Array.isArray(s.score) &&
    s.score.length === 2 &&
    Array.isArray(s.picks) &&
    s.picks.length === 2 &&
    s.picks.every((p) => p === null || isThrow(p)) &&
    validRpsView(rpsView(s, 0)) &&
    validRpsView(rpsView(s, 1))
  );
}
export function applyRpsRoom(
  s: RpsRoomState,
  action: unknown,
  seat: number,
  now = Date.now(),
): RpsRoomState | null {
  const a = action as { type?: string; choice?: unknown };
  if (!a || typeof a !== 'object' || ![0, 1].includes(seat)) return null;
  if (
    a.type === 'next' &&
    Object.keys(a).length === 1 &&
    seat === 0 &&
    s.phase === 'reveal' &&
    !rpsRoomDone(s)
  )
    return { ...s, picks: [null, null], phase: 'picking', deadline: 0 };
  if (
    a.type !== 'pick' ||
    Object.keys(a).length !== 2 ||
    !isThrow(a.choice) ||
    s.phase !== 'picking' ||
    s.picks[seat] !== null
  )
    return null;
  const picks: RpsRoomState['picks'] = [...s.picks];
  picks[seat] = a.choice;
  return {
    ...s,
    picks,
    phase: picks.every(Boolean) ? 'countdown' : 'picking',
    deadline: picks.every(Boolean) ? now + 2240 : 0,
  };
}
export function revealRpsRoom(
  s: RpsRoomState,
  now = Date.now(),
): RpsRoomState | null {
  if (s.phase !== 'countdown' || now < s.deadline || !s.picks[0] || !s.picks[1])
    return null;
  const score: [number, number] = [...s.score],
    winner = rpsWinner(s.picks[0], s.picks[1]);
  if (winner !== null) score[winner]++;
  return { ...s, score, turns: s.turns + 1, phase: 'reveal', deadline: 0 };
}
