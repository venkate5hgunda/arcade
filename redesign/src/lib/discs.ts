// Shared fixed-step disc physics, ported from the original Arcade solver.
export interface Disc {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  invMass?: number;
  pocketed?: boolean;
}
export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
export function canvasPoint(
  canvas: HTMLCanvasElement,
  event: PointerEvent,
  width: number,
  height: number,
) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - r.left) * width) / r.width,
    y: ((event.clientY - r.top) * height) / r.height,
  };
}
export function fixedStepper(step: (dt: number) => void, hz = 120) {
  const interval = 1 / hz;
  let previous: number | null = null,
    accumulator = 0;
  return {
    tick(time: number) {
      if (previous === null) {
        previous = time;
        return;
      }
      accumulator += Math.min(0.1, Math.max(0, (time - previous) / 1000));
      previous = time;
      let count = 0;
      while (accumulator >= interval && count < 12) {
        count++;
        step(interval);
        accumulator -= interval;
      }
      if (count === 12 && accumulator >= interval) accumulator = 0;
    },
    reset() {
      previous = null;
      accumulator = 0;
    },
  };
}
export function stepDiscs<T extends Disc>(
  bodies: T[],
  dt: number,
  {
    bounds,
    pockets = [],
    friction = 0,
    restitution = 0.94,
    onCollision,
    onRail,
    onPocket,
  }: {
    bounds?: Bounds;
    pockets?: { x: number; y: number; r: number }[];
    friction?: number;
    restitution?: number;
    onCollision?: (a: T, b: T, force: number) => void;
    onRail?: (body: T) => void;
    onPocket?: (body: T, pocket: { x: number; y: number; r: number }) => void;
  } = {},
) {
  for (const body of bodies) {
    if (body.pocketed || body.invMass === 0) continue;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    const speed = Math.hypot(body.vx, body.vy);
    if (speed) {
      const next = Math.max(0, speed - friction * dt);
      body.vx *= next / speed;
      body.vy *= next / speed;
    }
    const pocket = pockets.find(
      (p) => Math.hypot(body.x - p.x, body.y - p.y) < p.r,
    );
    if (pocket) {
      body.pocketed = true;
      body.vx = body.vy = 0;
      onPocket?.(body, pocket);
      continue;
    }
    if (!bounds) continue;
    for (const axis of ['x', 'y'] as const) {
      const lower = axis === 'x' ? bounds.left : bounds.top,
        upper = axis === 'x' ? bounds.right : bounds.bottom,
        min = lower + body.r,
        max = upper - body.r;
      if (body[axis] < min || body[axis] > max) {
        body[axis] = clamp(body[axis], min, max);
        if (axis === 'x') body.vx *= -restitution;
        else body.vy *= -restitution;
        onRail?.(body);
      }
    }
  }
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    if (a.pocketed) continue;
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      if (b.pocketed) continue;
      const dx = b.x - a.x,
        dy = b.y - a.y,
        distance = Math.hypot(dx, dy),
        overlap = a.r + b.r - distance;
      if (overlap <= 0) continue;
      const nx = distance ? dx / distance : 1,
        ny = distance ? dy / distance : 0,
        ma = a.invMass ?? 1,
        mb = b.invMass ?? 1,
        mass = ma + mb;
      if (!mass) continue;
      const correction = Math.max(0, overlap - 0.001) / mass;
      a.x -= nx * correction * ma;
      a.y -= ny * correction * ma;
      b.x += nx * correction * mb;
      b.y += ny * correction * mb;
      const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (relative >= 0) continue;
      const impulse = (-(1 + restitution) * relative) / mass;
      a.vx -= impulse * ma * nx;
      a.vy -= impulse * ma * ny;
      b.vx += impulse * mb * nx;
      b.vy += impulse * mb * ny;
      onCollision?.(a, b, -relative);
    }
  }
}
