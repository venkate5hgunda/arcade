import { clamp, stepDiscs } from './discs.ts';
import type { Disc, Bounds } from './discs.ts';
export const HOCKEY_W = 600,
  HOCKEY_H = 900;
export interface HockeyState {
  target: number;
  paddles: { x: number; y: number; score: number }[];
  puck: { x: number; y: number; vx: number; vy: number };
  waitingFor: 0 | 1 | null;
  openingFaceoff: boolean;
  over?: boolean;
  winner?: number | null;
}
export interface Paddle extends Disc {
  score: number;
  color: string;
}
export interface HockeyWorld {
  target: number;
  paddles: [Paddle, Paddle];
  puck: Disc;
  waitingFor: 0 | 1 | null;
  openingFaceoff: boolean;
  winner: number | null;
}
export function validHockey(value: unknown): value is HockeyState {
  const s = value as HockeyState;
  const point = (p: { x: number; y: number }, minY: number, maxY: number) =>
    p &&
    Number.isFinite(p.x) &&
    p.x >= 60 &&
    p.x <= 540 &&
    Number.isFinite(p.y) &&
    p.y >= minY &&
    p.y <= maxY;
  return (
    !!s &&
    [5, 7, 10].includes(s.target) &&
    Array.isArray(s.paddles) &&
    s.paddles.length === 2 &&
    s.paddles.every(
      (p, i) =>
        point(p, i ? 60 : 492, i ? 408 : 840) &&
        Number.isInteger(p.score) &&
        p.score >= 0 &&
        p.score < s.target,
    ) &&
    !!s.puck &&
    Number.isFinite(s.puck.x) &&
    s.puck.x >= 0 &&
    s.puck.x <= 600 &&
    Number.isFinite(s.puck.y) &&
    s.puck.y >= 0 &&
    s.puck.y <= 900 &&
    Number.isFinite(s.puck.vx) &&
    Math.abs(s.puck.vx) <= 1200 &&
    Number.isFinite(s.puck.vy) &&
    Math.abs(s.puck.vy) <= 1200 &&
    (s.waitingFor === undefined ||
      s.waitingFor === null ||
      s.waitingFor === 0 ||
      s.waitingFor === 1) &&
    (s.openingFaceoff === undefined || typeof s.openingFaceoff === 'boolean') &&
    (!s.openingFaceoff ||
      (s.waitingFor == null &&
        s.puck.x === 300 &&
        s.puck.y === 450 &&
        s.puck.vx === 0 &&
        s.puck.vy === 0 &&
        s.paddles.every((p) => p.score === 0))) &&
    (s.waitingFor == null ||
      (s.puck.x === 300 &&
        s.puck.y === (s.waitingFor === 0 ? 610 : 290) &&
        s.puck.vx === 0 &&
        s.puck.vy === 0))
  );
}
export function newHockey(target: number): HockeyState {
  return {
    target,
    paddles: [
      { x: 300, y: 740, score: 0 },
      { x: 300, y: 160, score: 0 },
    ],
    puck: { x: 300, y: 450, vx: 0, vy: 0 },
    waitingFor: null,
    openingFaceoff: true,
  };
}
export function worldHockey(s: HockeyState): HockeyWorld {
  return {
    target: s.target,
    paddles: s.paddles.map((p, i) => ({
      ...p,
      vx: 0,
      vy: 0,
      r: 37,
      invMass: 0,
      color: i ? '#57d4f6' : '#ff6747',
    })) as [Paddle, Paddle],
    puck: { ...s.puck, r: 17 },
    waitingFor: s.waitingFor ?? null,
    openingFaceoff: s.openingFaceoff ?? false,
    winner: null,
  };
}
export function snapshotHockey(w: HockeyWorld): HockeyState {
  return {
    target: w.target,
    paddles: w.paddles.map(({ x, y, score }) => ({ x, y, score })),
    puck: { x: w.puck.x, y: w.puck.y, vx: w.puck.vx, vy: w.puck.vy },
    waitingFor: w.waitingFor,
    openingFaceoff: w.openingFaceoff,
    ...(w.winner !== null ? { over: true, winner: w.winner } : {}),
  };
}
export function strikePuck(puck: Disc, paddle: Disc): boolean {
  const dx = puck.x - paddle.x,
    dy = puck.y - paddle.y,
    distance = Math.hypot(dx, dy);
  if (!distance || distance > puck.r + paddle.r) return false;
  const nx = dx / distance,
    ny = dy / distance,
    speed = paddle.vx * nx + paddle.vy * ny;
  if (speed <= 0) return false;
  const impact = Math.min(1050, (1 + 0.93) * speed);
  puck.vx = nx * impact;
  puck.vy = ny * impact;
  return true;
}
export function acceleratePaddle(
  p: Disc,
  vx: number,
  vy: number,
  dt: number,
  b: Bounds,
) {
  const dx = vx - p.vx,
    dy = vy - p.vy,
    d = Math.hypot(dx, dy),
    f = d ? Math.min(1, (22000 * dt) / d) : 1,
    x = clamp(p.x + (p.vx + dx * f) * dt, b.left, b.right),
    y = clamp(p.y + (p.vy + dy * f) * dt, b.top, b.bottom);
  p.vx = (x - p.x) / dt;
  p.vy = (y - p.y) / dt;
  p.x = x;
  p.y = y;
}
export function hockeyStep(
  w: HockeyWorld,
  dt: number,
  desired: [{ x: number; y: number }, { x: number; y: number }],
): number | null {
  if (w.winner !== null) return null;
  w.paddles.forEach((p, i) =>
    acceleratePaddle(p, desired[i].x, desired[i].y, dt, {
      left: 60,
      right: 540,
      top: i ? 60 : 492,
      bottom: i ? 408 : 840,
    }),
  );
  if (w.openingFaceoff) {
    if (!w.paddles.some((p) => strikePuck(w.puck, p))) return null;
    w.openingFaceoff = false;
  }
  if (w.waitingFor !== null) {
    if (!strikePuck(w.puck, w.paddles[w.waitingFor])) return null;
    w.waitingFor = null;
  }
  stepDiscs<Disc>([w.puck, ...w.paddles], dt, {
    bounds: { left: 23, right: 577, top: -10000, bottom: 10000 },
    friction: 190,
    restitution: 0.93,
    onCollision(a, b) {
      if (a === w.puck || b === w.puck) {
        const speed = Math.hypot(w.puck.vx, w.puck.vy);
        if (speed > 1050) {
          w.puck.vx *= 1050 / speed;
          w.puck.vy *= 1050 / speed;
        }
      }
    },
  });
  let scorer: number | null = null;
  if (w.puck.y - w.puck.r <= 23) {
    if (w.puck.x > 195 && w.puck.x < 405) scorer = 0;
    else {
      w.puck.y = 40;
      w.puck.vy = Math.abs(w.puck.vy) * 0.94;
    }
  } else if (w.puck.y + w.puck.r >= 877) {
    if (w.puck.x > 195 && w.puck.x < 405) scorer = 1;
    else {
      w.puck.y = 860;
      w.puck.vy = -Math.abs(w.puck.vy) * 0.94;
    }
  }
  if (scorer !== null) {
    w.paddles[scorer].score++;
    if (w.paddles[scorer].score >= w.target) {
      w.winner = scorer;
      w.puck.vx = w.puck.vy = 0;
    } else {
      w.openingFaceoff = false;
      w.waitingFor = (1 - scorer) as 0 | 1;
      w.puck.x = 300;
      w.puck.y = w.waitingFor === 0 ? 610 : 290;
      w.puck.vx = w.puck.vy = 0;
    }
  }
  return scorer;
}
