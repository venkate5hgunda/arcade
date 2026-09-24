// Shared, dependency-free disc simulation. Coordinates are arbitrary world units;
// velocities and friction are world units per second.
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function canvasPoint(canvas, event, width, height) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * width / rect.width,
    y: (event.clientY - rect.top) * height / rect.height,
  };
}

export function createFixedStepper(step, hz = 120) {
  const interval = 1 / hz;
  let previous = null;
  let accumulator = 0;
  return {
    tick(time) {
      if (previous === null) { previous = time; return; }
      accumulator += Math.min(0.1, Math.max(0, (time - previous) / 1000));
      previous = time;
      let iterations = 0;
      while (accumulator >= interval && iterations < 12) {
        iterations++;
        step(interval);
        accumulator -= interval;
      }
      if (iterations === 12 && accumulator >= interval) accumulator = 0;
    },
    reset() { previous = null; accumulator = 0; },
  };
}

// Bodies: {x,y,vx,vy,r,invMass?,pocketed?}. invMass=0 makes a
// kinematically moved paddle; omitted invMass means an ordinary unit-mass disc.
// bounds: {left,right,top,bottom}. Pockets: [{x,y,r}].
export function stepDiscs(bodies, dt, {
  bounds, pockets = [], friction = 0, restitution = 0.94,
  onCollision, onRail, onPocket,
} = {}) {
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
    const pocket = pockets.find((p) => Math.hypot(body.x - p.x, body.y - p.y) < p.r);
    if (pocket) {
      body.pocketed = true;
      body.vx = body.vy = 0;
      onPocket?.(body, pocket);
      continue;
    }
    if (!bounds) continue;
    for (const [axis, lower, upper] of [
      ['x', bounds.left, bounds.right], ['y', bounds.top, bounds.bottom],
    ]) {
      const min = lower + body.r, max = upper - body.r;
      if (body[axis] < min || body[axis] > max) {
        body[axis] = clamp(body[axis], min, max);
        body['v' + axis] *= -restitution;
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
      let dx = b.x - a.x, dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      const overlap = a.r + b.r - distance;
      if (overlap <= 0) continue;
      const nx = distance ? dx / distance : 1;
      const ny = distance ? dy / distance : 0;
      const ma = a.invMass ?? 1, mb = b.invMass ?? 1;
      const mass = ma + mb;
      if (!mass) continue;
      const correction = Math.max(0, overlap - 0.001) / mass;
      a.x -= nx * correction * ma; a.y -= ny * correction * ma;
      b.x += nx * correction * mb; b.y += ny * correction * mb;
      const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (relative >= 0) continue;
      const impulse = -(1 + restitution) * relative / mass;
      a.vx -= impulse * ma * nx; a.vy -= impulse * ma * ny;
      b.vx += impulse * mb * nx; b.vy += impulse * mb * ny;
      onCollision?.(a, b, -relative);
    }
  }
}
