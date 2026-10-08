// Small spring-physics helper for fluid, weighted controls. Values animate
// toward a target using a damped spring, so motion carries momentum and
// settles softly. Without requestAnimationFrame or with reduced motion
// preferred, updates are applied immediately.

const reducedMotion = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const SPRING = Object.freeze({
  follow: { stiffness: 700, damping: 48 },
  settle: { stiffness: 170, damping: 19 },
});

export function createSpring(onUpdate, { precision = 0.01, ...config } = SPRING.settle) {
  let value = null, velocity = 0, target = 0, frame = 0, last = 0, onRest = null;
  let { stiffness, damping } = { ...SPRING.settle, ...config };
  const raf = globalThis.requestAnimationFrame?.bind(globalThis);
  const caf = globalThis.cancelAnimationFrame?.bind(globalThis);

  function stop() {
    if (frame) caf?.(frame);
    frame = 0;
  }
  function rest() {
    stop();
    value = target;
    velocity = 0;
    onUpdate(value);
    const done = onRest;
    onRest = null;
    done?.();
  }
  function tick(now) {
    const dt = Math.min(0.034, Math.max(0.001, (now - last) / 1000));
    last = now;
    const steps = 4, h = dt / steps;
    for (let index = 0; index < steps; index++) {
      velocity += (-stiffness * (value - target) - damping * velocity) * h;
      value += velocity * h;
    }
    if (Math.abs(velocity) < precision * 10 && Math.abs(value - target) < precision) return rest();
    onUpdate(value);
    frame = raf(tick);
  }

  return {
    get value() { return value; },
    get target() { return target; },
    jump(next) {
      stop();
      value = target = next;
      velocity = 0;
      onUpdate(value);
    },
    stop() {
      stop();
      velocity = 0;
    },
    to(next, options = {}) {
      target = next;
      ({ stiffness = stiffness, damping = damping } = options);
      if (options.velocity !== undefined) velocity = options.velocity;
      onRest = options.onRest ?? null;
      if (value === null || !raf || reducedMotion()) return rest();
      if (!frame) {
        last = globalThis.performance?.now() ?? Date.now();
        frame = raf(tick);
      }
    },
  };
}

// Soft detent: within `window` of a mark the output is pulled toward the mark
// (cubic easing), so movement feels sticky there but can be pushed through.
export function detent(value, spacing, window) {
  if (!window) return value;
  const mark = Math.round(value / spacing) * spacing;
  const offset = value - mark;
  if (Math.abs(offset) >= window) return value;
  return mark + Math.sign(offset) * window * (Math.abs(offset) / window) ** 3;
}
