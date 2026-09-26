const SNAKE_CANDIDATES = [
  [94, 69], [89, 37], [83, 45], [76, 24], [68, 31],
  [63, 18], [58, 12], [49, 16], [43, 7], [34, 11], [27, 6],
];
const GIANT_SNAKE = { start: 99, end: 21, color: '#c9955e', giant: true };
const LADDER_CANDIDATES = [
  [2, 38], [5, 25], [9, 33], [14, 46], [20, 61], [28, 55],
  [36, 72], [42, 81], [51, 88], [57, 96], [66, 92], [71, 97],
];
const SNAKE_COLORS = ['#728868', '#aa775e', '#7d8268', '#5a8985', '#917967', '#889468'];
const LADDER_COLORS = ['#f8d87c', '#6ee7b7', '#7dd3fc', '#fda4af', '#c4b5fd'];

function seededRandom(seed) {
  if (seed === undefined || seed === null) return Math.random;
  let value = 2166136261;
  for (const char of String(seed)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pathClear(first, second) {
  const distanceSquared = (point, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
    return (point.x - a.x - dx * t) ** 2 + (point.y - a.y - dy * t) ** 2;
  };
  const cross = (a, b, p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  for (let i = 1; i < first.length; i++) {
    for (let j = 1; j < second.length; j++) {
      const [a, b] = [first[i - 1], first[i]];
      const [c, d] = [second[j - 1], second[j]];
      if ((cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0) ||
          Math.min(distanceSquared(a, c, d), distanceSquared(b, c, d),
            distanceSquared(c, a, b), distanceSquared(d, a, b)) < 32 ** 2) return false;
    }
  }
  return true;
}

export function createBoardLayout(seed) {
  const random = seededRandom(seed);
  let best = { snakes: [], ladders: [] };
  for (let attempt = 0; attempt < 48; attempt++) {
    const used = new Set([1, 100, GIANT_SNAKE.start, GIANT_SNAKE.end]);
    const snakes = [{ ...GIANT_SNAKE }], ladders = [];
    const paths = [snakeTravelPoints(GIANT_SNAKE).filter((_, index) => index % 2 === 0)];
    const candidates = [
      shuffle(SNAKE_CANDIDATES, random),
      shuffle(LADDER_CANDIDATES, random),
    ];
    for (let turn = 0; turn < 4; turn++) {
      for (const [kind, list] of candidates.entries()) {
        let chosenPath;
        const choice = list.find(([start, end]) => {
          if (used.has(start) || used.has(end)) return false;
          const candidate = kind === 0
            ? snakeTravelPoints({ start, end }).filter((_, index) => index % 2 === 0)
            : [squareCenter(start), squareCenter(end)];
          if (paths.some((path) => !pathClear(candidate, path))) return false;
          chosenPath = candidate;
          return true;
        });
        if (!choice) continue;
        const [start, end] = choice;
        paths.push(chosenPath);
        used.add(start); used.add(end);
        const output = kind === 0 ? snakes : ladders;
        const colors = kind === 0 ? SNAKE_COLORS : LADDER_COLORS;
        output.push({ start, end, color: colors[output.length % colors.length] });
      }
    }
    if (Math.min(snakes.length, ladders.length) > Math.min(best.snakes.length, best.ladders.length) ||
        (Math.min(snakes.length, ladders.length) === Math.min(best.snakes.length, best.ladders.length) &&
          snakes.length + ladders.length > best.snakes.length + best.ladders.length))
      best = { snakes, ladders };
    if (snakes.length === 5 && ladders.length === 4) break;
  }
  return best;
}

export function squareCenter(number) {
  const rank = Math.floor((number - 1) / 10);
  const slot = (number - 1) % 10;
  return { x: ((rank % 2 ? 9 - slot : slot) + .5) * 100, y: (9 - rank + .5) * 100 };
}

export function segmentsCross(firstStart, firstEnd, secondStart, secondEnd) {
  const a = squareCenter(firstStart), b = squareCenter(firstEnd);
  const c = squareCenter(secondStart), d = squareCenter(secondEnd);
  const side = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

function ladderShape({ start, end, color }) {
  const a = squareCenter(start), b = squareCenter(end);
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy), nx = -dy / len * 13, ny = dx / len * 13;
  const rails = [-1, 1].map((s) =>
    `<path d="M ${a.x + nx * s} ${a.y + ny * s} L ${b.x + nx * s} ${b.y + ny * s}"/>`).join('');
  const rungCount = Math.max(3, Math.floor(len / 58));
  const rungs = Array.from({ length: rungCount }, (_, i) => {
    const t = (i + 1) / (rungCount + 1), x = a.x + dx * t, y = a.y + dy * t;
    return `<path d="M ${x - nx} ${y - ny} L ${x + nx} ${y + ny}"/>`;
  }).join('');
  return `<g class="sl-art-ladder" data-foot="${start}" fill="none" stroke-linecap="round">
    <g stroke="#203735" stroke-width="12">${rails}</g>
    <g stroke="${color}" stroke-width="7">${rails}</g>
    <g stroke="#f9f7dc" stroke-width="5">${rungs}</g>
  </g>`;
}

export function snakeTravelPoints({ start, end }) {
  const head = squareCenter(start), tail = squareCenter(end);
  const dx = tail.x - head.x, dy = tail.y - head.y;
  const length = Math.hypot(dx, dy), nx = -dy / length, ny = dx / length;
  const seed = start * .32;
  return Array.from({ length: 41 }, (_, i) => {
    const t = i / 40, wave = Math.sin(t * Math.PI * (length > 400 ? 4 : 3) + seed) * 24 * Math.sin(t * Math.PI);
    return { x: head.x + dx * t + nx * wave, y: head.y + dy * t + ny * wave };
  });
}

export function ladderTravelPoints({ start, end }) {
  const foot = squareCenter(start), top = squareCenter(end);
  const dx = top.x - foot.x, dy = top.y - foot.y;
  const length = Math.hypot(dx, dy);
  const nx = -dy / length, ny = dx / length;
  return Array.from({ length: 25 }, (_, i) => {
    const t = i / 24;
    const sway = Math.sin(t * Math.PI * 7) * 9 * Math.sin(t * Math.PI);
    return { x: foot.x + dx * t + nx * sway, y: foot.y + dy * t + ny * sway };
  });
}

function snakeShape(snake) {
  const { start, color, giant } = snake;
  const points = snakeTravelPoints(snake);
  const path = (from, to) => points.slice(from, to + 1)
    .map((point, i) => `${i ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const head = points[0], neck = points[3];
  const length = Math.hypot(head.x - neck.x, head.y - neck.y);
  const fx = (head.x - neck.x) / length, fy = (head.y - neck.y) / length;
  const sx = -fy, sy = fx;
  const point = (forward, side) =>
    `${(head.x + fx * forward + sx * side).toFixed(1)} ${(head.y + fy * forward + sy * side).toFixed(1)}`;
  const scales = points.slice(4, 36).filter((_, i) => i % 2 === 0).map((p, i) => {
    const before = points[3 + i * 2], after = points[5 + i * 2];
    const length = Math.hypot(after.x - before.x, after.y - before.y);
    const nx = -(after.y - before.y) / length, ny = (after.x - before.x) / length;
    return [-1, 1].map((side) =>
      `<ellipse cx="${(p.x + side * nx * 7).toFixed(1)}" cy="${(p.y + side * ny * 7).toFixed(1)}"
        rx="3.6" ry="5.4" fill="#17282b" fill-opacity="${i % 2 ? '.27' : '.17'}"/>`).join('');
  }).join('');
  return `<g class="sl-art-snake${giant ? ' sl-art-snake-giant' : ''}" data-head="${start}">
    <path d="${path(0, 30)}" stroke="#17282b" stroke-width="${giant ? 34 : 30}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${path(0, 30)}" stroke="${color}" stroke-width="${giant ? 28 : 24}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <g class="sl-art-tail" style="transform-origin:${points[28].x.toFixed(1)}px ${points[28].y.toFixed(1)}px">
      <path d="${path(28, 34)}" stroke="#17282b" stroke-width="22" fill="none" stroke-linecap="round"/>
      <path d="${path(28, 34)}" stroke="${color}" stroke-width="17" fill="none" stroke-linecap="round"/>
      <path d="${path(34, 38)}" stroke="#17282b" stroke-width="13" fill="none" stroke-linecap="round"/>
      <path d="${path(34, 38)}" stroke="${color}" stroke-width="9" fill="none" stroke-linecap="round"/>
      <path d="${path(38, 40)}" stroke="${color}" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="${path(28, 38)}" stroke="#f7e8c5" stroke-opacity=".45" stroke-width="3" fill="none" stroke-linecap="round"/>
    </g>
    <path d="${path(2, 28)}" stroke="#f7e8c5" stroke-opacity=".55" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${scales}
    <path d="M ${point(-8, -11)} Q ${point(12, -19)} ${point(24, -6)}
      L ${point(32, 0)} L ${point(24, 6)} Q ${point(12, 19)} ${point(-8, 11)} Z"
      fill="${color}" stroke="#17282b" stroke-width="3"/>
    <path d="M ${point(20, -8)} Q ${point(29, 0)} ${point(20, 8)}" fill="none" stroke="#17282b" stroke-width="2"/>
    <ellipse cx="${head.x + fx * 7 + sx * 12}" cy="${head.y + fy * 7 + sy * 12}" rx="3.5" ry="2.8" fill="#132526"/>
    <ellipse cx="${head.x + fx * 7 - sx * 12}" cy="${head.y + fy * 7 - sy * 12}" rx="3.5" ry="2.8" fill="#132526"/>
    <circle cx="${head.x + fx * 25 + sx * 4}" cy="${head.y + fy * 25 + sy * 4}" r="1.7" fill="#17282b"/>
    <circle cx="${head.x + fx * 25 - sx * 4}" cy="${head.y + fy * 25 - sy * 4}" r="1.7" fill="#17282b"/>
    <path class="sl-art-tongue" style="transform-origin:${point(32, 0).replace(' ', 'px ')}px"
      d="M ${point(32, 0)} L ${point(47, 0)} M ${point(47, 0)} L ${point(54, -5)} M ${point(47, 0)} L ${point(54, 5)}"
      fill="none" stroke="#db7787" stroke-width="2" stroke-linecap="round"/>
  </g>`;
}

export function boardArt(layout) {
  return `<svg class="sl-art" viewBox="0 0 1000 1000" aria-hidden="true" preserveAspectRatio="none">
    ${layout.ladders.map(ladderShape).join('')}${layout.snakes.map(snakeShape).join('')}
  </svg>`;
}
