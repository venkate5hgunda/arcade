// Shared Pick-style tabletop roller for one or two six-sided dice.
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

function validateValues(values) {
  if (!Array.isArray(values) || ![1, 2].includes(values.length) ||
      values.some(value => !Number.isInteger(value) || value < 1 || value > 6))
    throw new RangeError('Dice must be one or two six-sided results');
}

export function rollDiceValues(count, random = () => {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] / 0x100000000;
}) {
  if (![1, 2].includes(count)) throw new RangeError('Roll one or two dice');
  return Array.from({ length: count }, () => {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1)
      throw new RangeError('Random source must return a value in [0, 1)');
    return 1 + Math.floor(sample * 6);
  });
}

export function diceMarkup(values = [1], label = 'Roll dice') {
  validateValues(values);
  return `<span class="arcade-die-arena${values.length === 2 ? ' arcade-die-arena--pair' : ''}" aria-hidden="true">
    ${values.map((value, index) => {
      const [rx, ry] = ORIENTATION[value];
      return `<span class="arcade-die" style="transform:translate3d(${values.length === 1 ? 65 : 35 + index * 90}px, 29px, 0)" aria-label="Rolled ${value}">
        <span class="arcade-die-cube" style="transform:rotateX(${rx}deg) rotateY(${ry}deg)">${Array.from({ length: 6 }, (_, i) => dieFace(i + 1)).join('')}</span>
      </span>`;
    }).join('')}
  </span>${label ? `<span class="arcade-roll-label">${label}</span>` : ''}`;
}

export function dieMarkup(value = 1) { return diceMarkup([value]); }

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

export async function rollDice(button, signal, predeterminedValues = null) {
  if (signal.aborted) return null;
  if (predeterminedValues !== null) validateValues(predeterminedValues);
  const arena = button.querySelector('.arcade-die-arena');
  if (!arena) throw new Error('Dice roller requires a dice arena');
  const dice = [...arena.querySelectorAll('.arcade-die')];
  if (![1, 2].includes(dice.length) || predeterminedValues && predeterminedValues.length !== dice.length)
    throw new RangeError('Dice roller and results must have the same number of dice');
  const values = predeterminedValues ?? rollDiceValues(dice.length);
  const width = arena.clientWidth, height = arena.clientHeight;
  if (!width || !height) throw new Error('Dice arena must be visible before rolling');
  const states = dice.map((die, index) => {
    const size = die.clientWidth;
    const angle = Math.PI * 2 * index / dice.length + (Math.random() - .5) * .75;
    const speed = 230 + Math.random() * 250;
    return {
      die, cube: die.querySelector('.arcade-die-cube'), value: values[index],
      radius: size * .72, size,
      x: width / 2 + Math.cos(angle) * 12, y: height / 2 + Math.sin(angle) * 12,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      rx: Math.random() * 180, ry: Math.random() * 180, rz: 0,
      angular: (Math.random() - .5) * 620,
    };
  });
  button.disabled = true;
  try {
    const audio = window.arcadeAudio;
    if (audio) void audio.prepare()
      .then(ready => { if (ready && !signal.aborted) audio.rattle(); })
      .catch(error => console.warn('Dice audio failed to start:', error));
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const completed = await new Promise((resolve) => {
        let frame, previous = performance.now(), elapsed = 0, accumulator = 0, impactAt = 0;
        const abort = () => {
          cancelAnimationFrame(frame);
          signal.removeEventListener('abort', abort);
          resolve(false);
        };
        signal.addEventListener('abort', abort, { once: true });
        function step(now) {
          const dt = Math.min((now - previous) / 1000, .05);
          previous = now;
          elapsed += dt;
          accumulator += dt;
          while (accumulator >= STEP) {
            for (const state of states) {
              state.x += state.vx * STEP;
              state.y += state.vy * STEP;
              state.rx += state.vy / state.size * 180 * STEP;
              state.ry -= state.vx / state.size * 180 * STEP;
              state.rz += state.angular * STEP;
              state.vx *= DRAG; state.vy *= DRAG; state.angular *= DRAG * .997;
              for (const axis of ['x', 'y']) {
                const limit = axis === 'x' ? width : height;
                if (state[axis] < state.radius || state[axis] > limit - state.radius) {
                  state[axis] = Math.max(state.radius, Math.min(limit - state.radius, state[axis]));
                  state[`v${axis}`] *= -RESTITUTION;
                  state.angular *= -.82;
                  if (now - impactAt > 42) {
                    window.arcadeAudio?.impact(Math.min(1, Math.abs(state[`v${axis}`]) / 430));
                    window.haptics?.select();
                    impactAt = now;
                  }
                }
              }
            }
            if (states.length === 2) {
              const [a, b] = states, dx = b.x - a.x, dy = b.y - a.y;
              const distance = Math.hypot(dx, dy) || 1;
              const minimum = (a.radius + b.radius) * 1.28 + 2;
              if (distance < minimum) {
                const nx = dx / distance, ny = dy / distance;
                const overlap = (minimum - distance) / 2;
                a.x -= nx * overlap; a.y -= ny * overlap;
                b.x += nx * overlap; b.y += ny * overlap;
                const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
                if (relative < 0) {
                  const impulse = -(1 + RESTITUTION) * relative / 2;
                  a.vx -= impulse * nx; a.vy -= impulse * ny;
                  b.vx += impulse * nx; b.vy += impulse * ny;
                  window.arcadeAudio?.impact(Math.min(1, Math.abs(relative) / 620));
                }
              }
            }
            accumulator -= STEP;
          }
          for (const state of states) {
            state.die.style.transform = `translate3d(${state.x - state.size / 2}px, ${state.y - state.size / 2}px, 0)`;
            state.cube.style.transform = `rotateX(${state.rx}deg) rotateY(${state.ry}deg) rotateZ(${state.rz}deg)`;
          }
          if (elapsed < 2.1 && (elapsed < .95 ||
              states.some(state => Math.hypot(state.vx, state.vy) > 15 || Math.abs(state.angular) > 22)))
            frame = requestAnimationFrame(step);
          else {
            signal.removeEventListener('abort', abort);
            resolve(true);
          }
        }
        frame = requestAnimationFrame(step);
      });
      if (!completed || signal.aborted) return null;
    }
    for (const state of states) {
      const [rx, ry] = ORIENTATION[state.value];
      const rotation = `rotateX(${rx}deg) rotateY(${ry}deg)`;
      const before = state.cube.style.transform;
      state.cube.style.transform = rotation;
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
        state.cube.animate([{ transform: before }, { transform: rotation }],
          { duration: 240, easing: 'cubic-bezier(.2,.9,.3,1)' });
      state.die.classList.add('is-settled');
      state.die.setAttribute('aria-label', `Rolled ${state.value}`);
    }
    return values;
  } finally {
    button.disabled = false;
  }
}

export async function rollDie(button, signal, predeterminedValue = null) {
  if (predeterminedValue !== null && (!Number.isInteger(predeterminedValue) || predeterminedValue < 1 || predeterminedValue > 6))
    throw new RangeError('Die result must be between 1 and 6');
  const values = await rollDice(button, signal, predeterminedValue === null ? null : [predeterminedValue]);
  return values?.[0] ?? null;
}
