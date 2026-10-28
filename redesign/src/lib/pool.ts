import { stepDiscs } from './discs.ts';
import type { Disc } from './discs.ts';
export const POOL_W = 1000,
  POOL_H = 540,
  POOL_R = 10.5;
export const TABLE = { left: 55, right: 945, top: 55, bottom: 485 };
export const POCKETS = [
  [55, 55],
  [500, 55],
  [945, 55],
  [55, 485],
  [500, 485],
  [945, 485],
].map(([x, y], i) => ({ x, y, r: i === 1 || i === 4 ? 23 : 27 }));
export const COLORS = [
  '#f8f8f4',
  '#f5ce41',
  '#1875c3',
  '#ed5052',
  '#743da3',
  '#ee9236',
  '#319958',
  '#81352f',
  '#191b26',
];
export type Group = 'solids' | 'stripes';
export interface SavedBall {
  number: number;
  x: number;
  y: number;
  pocketed: boolean;
}
export type PoolBall = SavedBall & Disc;
export interface PoolState {
  break: '1' | '2';
  player: 0 | 1;
  assignments: [Group | null, Group | null];
  shots: number;
  aim: number;
  power: number;
  balls: SavedBall[];
  over?: boolean;
  winner?: number | null;
  message?: string;
}
export interface PoolWorld {
  state: PoolState;
  balls: PoolBall[];
  rolling: boolean;
  winner: number | null;
  shot: {
    firstHit: number | null;
    railAfterHit: boolean;
    pocketed: number[];
    remainingBefore: number;
  } | null;
  settle: number;
}
export const group = (n: number): Group | null =>
  n === 0 || n === 8 ? null : n < 8 ? 'solids' : 'stripes';
export function rack(random = Math.random): SavedBall[] {
  const solids = [1, 2, 3, 4, 5, 6, 7],
    stripes = [9, 10, 11, 12, 13, 14, 15];
  for (const list of [solids, stripes])
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  const remaining = [...solids.slice(1), ...stripes.slice(1)],
    numbers: (number | null)[] = [
      null,
      null,
      null,
      null,
      8,
      null,
      null,
      null,
      null,
      null,
      solids[0],
      null,
      null,
      null,
      stripes[0],
    ];
  for (let i = 0; i < numbers.length; i++)
    if (numbers[i] === null) numbers[i] = remaining.shift()!;
  const balls: SavedBall[] = [{ number: 0, x: 265, y: 270, pocketed: false }];
  let index = 0;
  for (let row = 0; row < 5; row++)
    for (let col = 0; col <= row; col++)
      balls.push({
        number: numbers[index++]!,
        x: 705 + row * 19.3,
        y: 270 + (col - row / 2) * 22.2,
        pocketed: false,
      });
  return balls;
}
export function newPool(breaker: '1' | '2'): PoolState {
  return {
    break: breaker,
    player: (Number(breaker) - 1) as 0 | 1,
    assignments: [null, null],
    shots: 0,
    aim: 0,
    power: 0.45,
    balls: rack(),
  };
}
export function validPool(value: unknown): value is PoolState {
  const s = value as PoolState;
  return (
    !!s &&
    ['1', '2'].includes(s.break) &&
    [0, 1].includes(s.player) &&
    Array.isArray(s.assignments) &&
    s.assignments.length === 2 &&
    (s.assignments.every((g) => g === null) ||
      (s.assignments[0] === 'solids' && s.assignments[1] === 'stripes') ||
      (s.assignments[0] === 'stripes' && s.assignments[1] === 'solids')) &&
    Number.isInteger(s.shots) &&
    s.shots >= 0 &&
    Number.isFinite(s.aim) &&
    Math.abs(s.aim) <= 1000 &&
    Number.isFinite(s.power) &&
    s.power >= 0.1 &&
    s.power <= 1 &&
    Array.isArray(s.balls) &&
    s.balls.length === 16 &&
    s.balls.every(
      (b) =>
        b &&
        Number.isInteger(b.number) &&
        b.number >= 0 &&
        b.number <= 15 &&
        Number.isFinite(b.x) &&
        b.x >= (b.pocketed ? 0 : TABLE.left - POOL_R) &&
        b.x <= (b.pocketed ? POOL_W : TABLE.right + POOL_R) &&
        Number.isFinite(b.y) &&
        b.y >= (b.pocketed ? 0 : TABLE.top - POOL_R) &&
        b.y <= (b.pocketed ? POOL_H : TABLE.bottom + POOL_R) &&
        typeof b.pocketed === 'boolean',
    ) &&
    new Set(s.balls.map((b) => b.number)).size === 16 &&
    s.balls[0].number === 0 &&
    !s.balls[0].pocketed &&
    !s.balls.find((b) => b.number === 8)?.pocketed
  );
}
export function worldPool(s: PoolState): PoolWorld {
  return {
    state: structuredClone(s),
    balls: s.balls.map((b) => ({ ...b, vx: 0, vy: 0, r: POOL_R })),
    rolling: false,
    winner: null,
    shot: null,
    settle: 0,
  };
}
export function snapshotPool(w: PoolWorld): PoolState {
  return {
    ...w.state,
    balls: w.balls.map(({ number, x, y, pocketed }) => ({
      number,
      x,
      y,
      pocketed: !!pocketed,
    })),
    ...(w.winner !== null ? { over: true, winner: w.winner } : {}),
  };
}
export function shootPool(w: PoolWorld): boolean {
  if (w.rolling || w.winner !== null || w.balls[0].pocketed) return false;
  w.state.shots++;
  const cue = w.balls[0],
    speed = 220 + 850 * w.state.power;
  cue.vx = Math.cos(w.state.aim) * speed;
  cue.vy = Math.sin(w.state.aim) * speed;
  w.shot = {
    firstHit: null,
    railAfterHit: false,
    pocketed: [],
    remainingBefore: w.state.assignments[w.state.player]
      ? w.balls.filter(
          (b) =>
            !b.pocketed &&
            group(b.number) === w.state.assignments[w.state.player],
        ).length
      : 7,
  };
  w.rolling = true;
  w.settle = 0;
  return true;
}
export function finishPoolShot(w: PoolWorld): string {
  if (!w.shot) return '';
  w.rolling = false;
  const taken = w.shot.pocketed,
    scratch = taken.includes(0),
    hit = w.shot.firstHit,
    player = w.state.player,
    other = (1 - player) as 0 | 1,
    assigned = w.state.assignments[player],
    canEight = !!assigned && !w.shot.remainingBefore;
  let foul = '';
  if (!hit) foul = 'No object ball hit';
  else if (assigned && (canEight ? hit !== 8 : group(hit) !== assigned))
    foul = 'Wrong ball contacted first';
  else if (hit && !w.shot.railAfterHit && !taken.some((n) => n !== 0))
    foul = 'No rail or pocket after contact';
  if (scratch) foul = 'Cue ball scratched';
  if (taken.includes(8)) {
    w.winner = !foul && canEight && hit === 8 ? player : other;
    return w.winner === player
      ? 'Legal 8-ball! Match won.'
      : 'Early or fouled 8-ball — opponent wins.';
  }
  if (!foul && !assigned) {
    const first = taken.find((n) => group(n));
    if (first) {
      w.state.assignments[player] = group(first);
      w.state.assignments[other] =
        group(first) === 'solids' ? 'stripes' : 'solids';
    }
  }
  const keep =
    !foul &&
    taken.some((n) => group(n) === w.state.assignments[player]) &&
    !!w.state.assignments[player];
  if (scratch) {
    const cue = w.balls[0],
      places: [number, number][] = [];
    for (let dx = 0; dx <= 180; dx += 24)
      for (let dy = 0; dy <= 170; dy += 24)
        places.push([265 + dx, 270 + dy], [265 + dx, 270 - dy]);
    const [x, y] = places.find(([x, y]) =>
      w.balls.every(
        (b) =>
          b === cue ||
          b.pocketed ||
          Math.hypot(b.x - x, b.y - y) >= POOL_R * 2 + 2,
      ),
    ) ?? [265, 270];
    Object.assign(cue, { x, y, vx: 0, vy: 0, pocketed: false });
  }
  if (!keep) w.state.player = other;
  return foul
    ? `Foul: ${foul}. ${scratch ? 'Cue ball respotted.' : ''}`
    : keep
      ? 'Pocketed your ball — shoot again!'
      : 'Turn passes.';
}
export function stepPool(
  w: PoolWorld,
  dt: number,
  onImpact?: (force: number) => void,
): string | null {
  if (!w.rolling || !w.shot) return null;
  stepDiscs(w.balls, dt, {
    bounds: TABLE,
    pockets: POCKETS,
    friction: 175,
    restitution: 0.92,
    onCollision(a, b, force) {
      onImpact?.(force);
      if (!w.shot!.firstHit && (a.number === 0 || b.number === 0))
        w.shot!.firstHit = a.number === 0 ? b.number : a.number;
    },
    onRail() {
      if (w.shot!.firstHit) w.shot!.railAfterHit = true;
    },
    onPocket(ball) {
      w.shot!.pocketed.push(ball.number);
    },
  });
  if (w.balls.every((b) => b.pocketed || Math.hypot(b.vx, b.vy) < 5)) {
    w.settle += dt;
    if (w.settle > 0.22) {
      for (const b of w.balls) if (!b.pocketed) b.vx = b.vy = 0;
      return finishPoolShot(w);
    }
  } else w.settle = 0;
  return null;
}
