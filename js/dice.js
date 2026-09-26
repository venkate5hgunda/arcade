// Adapted from Pick's dice animation: fixed-step tabletop momentum, bounces,
// tumbling cube and a final orientation that matches the actual roll.
const STEP = 1 / 120;
const RESTITUTION = .72;
const DRAG = .982;
export const ROLL_REVEAL_DELAY_MS = 850;
const PIPS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8],
  4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
const ORIENTATION = {
  1: [0, 0], 2: [0, -90], 3: [-90, 0],
  4: [90, 0], 5: [0, 90], 6: [0, 180],
};

function dieFace(value) {
  return `<span class="arcade-die-face arcade-die-face-${value}">${Array.from({ length: 9 }, (_, index) =>
    `<i class="arcade-pip${PIPS[value].includes(index) ? '' : ' arcade-pip-hidden'}"></i>`).join('')}</span>`;
}

export function dieMarkup(value = 1) {
  const [rx, ry] = ORIENTATION[value] ?? ORIENTATION[1];
  return `<span class="arcade-die-arena" aria-hidden="true">
    <span class="arcade-die"><span class="arcade-die-cube" style="transform:rotateX(${rx}deg) rotateY(${ry}deg)">${Array.from({ length: 6 }, (_, i) => dieFace(i + 1)).join('')}</span></span>
  </span><span class="arcade-roll-label">Roll dice</span>`;
}

export function pauseAfterRoll(signal) {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const abort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve(true);
    }, ROLL_REVEAL_DELAY_MS);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

export async function rollDie(button, signal, predeterminedValue = null) {
  if (signal.aborted) return null;
  if (predeterminedValue !== null && (!Number.isInteger(predeterminedValue) || predeterminedValue < 1 || predeterminedValue > 6))
    throw new RangeError('Die result must be between 1 and 6');
  const arena = button.querySelector('.arcade-die-arena');
  const die = button.querySelector('.arcade-die');
  const cube = die.querySelector('.arcade-die-cube');
  const value = predeterminedValue ?? 1 + Math.floor(Math.random() * 6);
  const width = arena.clientWidth, height = arena.clientHeight;
  const size = die.clientWidth;
  const radius = size * .72;
  const state = {
    x: width / 2, y: height / 2,
    vx: (Math.random() > .5 ? 1 : -1) * (210 + Math.random() * 120),
    vy: (Math.random() > .5 ? 1 : -1) * (130 + Math.random() * 140),
    rx: Math.random() * 180, ry: Math.random() * 180, rz: 0,
    angular: 430 + Math.random() * 200,
  };
  button.disabled = true;
  die.classList.remove('is-settled');
  await window.arcadeAudio?.prepare();
  if (signal.aborted) { button.disabled = false; return null; }
  window.arcadeAudio?.rattle();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const [rx, ry] = ORIENTATION[value];
    cube.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    button.disabled = false;
    die.setAttribute('aria-label', `Rolled ${value}`);
    return value;
  }
  return new Promise((resolve) => {
    let frame, previous = performance.now(), elapsed = 0, accumulator = 0, impactAt = 0;
    const abort = () => {
      cancelAnimationFrame(frame);
      signal.removeEventListener('abort', abort);
      button.disabled = false;
      resolve(null);
    };
    signal.addEventListener('abort', abort, { once: true });
    function step(now) {
      const dt = Math.min((now - previous) / 1000, .05);
      previous = now;
      elapsed += dt;
      accumulator += dt;
      while (accumulator >= STEP) {
        const drag = DRAG;
        state.x += state.vx * STEP;
        state.y += state.vy * STEP;
        state.rx += state.vy / size * 180 * STEP;
        state.ry -= state.vx / size * 180 * STEP;
        state.rz += state.angular * STEP;
        state.vx *= drag; state.vy *= drag; state.angular *= drag * .997;
        for (const axis of ['x', 'y']) {
          const limit = axis === 'x' ? width : height;
          if (state[axis] < radius || state[axis] > limit - radius) {
            state[axis] = Math.max(radius, Math.min(limit - radius, state[axis]));
            state[`v${axis}`] *= -RESTITUTION;
            if (now - impactAt > 75) {
              window.arcadeAudio?.impact(Math.min(1, Math.abs(state[`v${axis}`]) / 430));
              window.haptics?.select();
              impactAt = now;
            }
          }
        }
        accumulator -= STEP;
      }
      die.style.transform = `translate3d(${state.x - size / 2}px, ${state.y - size / 2}px, 0)`;
      cube.style.transform = `rotateX(${state.rx}deg) rotateY(${state.ry}deg) rotateZ(${state.rz}deg)`;
      if (elapsed < 1.55 && (elapsed < .85 || Math.hypot(state.vx, state.vy) > 15)) {
        frame = requestAnimationFrame(step);
      } else {
        signal.removeEventListener('abort', abort);
        const [rx, ry] = ORIENTATION[value];
        const rotation = `rotateX(${rx}deg) rotateY(${ry}deg)`;
        const previousRotation = cube.style.transform;
        cube.style.transform = rotation;
        cube.animate([{ transform: previousRotation }, { transform: rotation }],
          { duration: 240, easing: 'cubic-bezier(.2,.9,.3,1)' });
        die.classList.add('is-settled');
        die.setAttribute('aria-label', `Rolled ${value}`);
        button.disabled = false;
        resolve(value);
      }
    }
    frame = requestAnimationFrame(step);
  });
}
