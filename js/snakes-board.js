const SNAKE_CANDIDATES = [
  [99, 54], [94, 69], [89, 37], [83, 45], [76, 24], [68, 31],
  [63, 18], [58, 12], [49, 16], [43, 7], [34, 11], [27, 6],
];
const LADDER_CANDIDATES = [
  [2, 38], [5, 25], [9, 33], [14, 46], [20, 61], [28, 55],
  [36, 72], [42, 81], [51, 88], [57, 96], [66, 92], [71, 97],
];
const SNAKE_COLORS = ['#f87171', '#fb923c', '#a78bfa', '#38bdf8', '#e879f9', '#facc15'];
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

export function createBoardLayout(seed) {
  const used = new Set([1, 100]);
  const snakes = [], ladders = [];
  const random = seededRandom(seed);
  for (const [head, tail] of shuffle(SNAKE_CANDIDATES, random)) {
    if (used.has(head) || used.has(tail) || snakes.length >= 6) continue;
    used.add(head); used.add(tail);
    snakes.push({ start: head, end: tail, color: SNAKE_COLORS[snakes.length % SNAKE_COLORS.length] });
  }
  for (const [foot, top] of shuffle(LADDER_CANDIDATES, random)) {
    if (used.has(foot) || used.has(top) || ladders.length >= 6) continue;
    used.add(foot); used.add(top);
    ladders.push({ start: foot, end: top, color: LADDER_COLORS[ladders.length % LADDER_COLORS.length] });
  }
  return { snakes, ladders };
}

export function squareCenter(number) {
  const rank = Math.floor((number - 1) / 10);
  const slot = (number - 1) % 10;
  return { x: ((rank % 2 ? 9 - slot : slot) + .5) * 100, y: (9 - rank + .5) * 100 };
}

function ladderShape({ start, end, color }) {
  const a = squareCenter(start), b = squareCenter(end);
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy), nx = -dy / len * 15, ny = dx / len * 15;
  const rails = [-1, 1].map((s) =>
    `<path d="M ${a.x + nx * s} ${a.y + ny * s} L ${b.x + nx * s} ${b.y + ny * s}"/>`).join('');
  const rungCount = Math.max(3, Math.floor(len / 52));
  const rungs = Array.from({ length: rungCount }, (_, i) => {
    const t = (i + 1) / (rungCount + 1), x = a.x + dx * t, y = a.y + dy * t;
    return `<path d="M ${x - nx} ${y - ny} L ${x + nx} ${y + ny}"/>`;
  }).join('');
  return `<g class="sl-art-ladder" stroke="${color}" stroke-width="9" stroke-linecap="round" fill="none">${rails}${rungs}</g>`;
}

function snakeShape({ start, end, color }) {
  const head = squareCenter(start), tail = squareCenter(end);
  const dx = tail.x - head.x, dy = tail.y - head.y;
  const length = Math.hypot(dx, dy), nx = -dy / length, ny = dx / length;
  const seed = start * .32;
  const points = Array.from({ length: 33 }, (_, i) => {
    const t = i / 32, wave = Math.sin(t * Math.PI * (length > 400 ? 5 : 3) + seed) * 29 * Math.sin(t * Math.PI);
    return { x: head.x + dx * t + nx * wave, y: head.y + dy * t + ny * wave };
  });
  const body = points.map((point, i) => `${i ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const eyes = [-1, 1].map((side) =>
    `<circle cx="${head.x - dx / length * 11 + nx * side * 11}" cy="${head.y - dy / length * 11 + ny * side * 11}" r="3.5" fill="#111827"/>`).join('');
  return `<g class="sl-art-snake">
    <path d="${body}" stroke="#17212f" stroke-width="33" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${body}" stroke="${color}" stroke-width="25" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${body}" stroke="#ffffff" stroke-opacity=".24" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="${head.x}" cy="${head.y}" r="21" fill="${color}" stroke="#17212f" stroke-width="3"/>
    ${eyes}<path d="M ${head.x - dx / length * 20} ${head.y - dy / length * 20} l ${-dx / length * 18} ${-dy / length * 18}" stroke="#fb7185" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${tail.x}" cy="${tail.y}" r="5" fill="${color}"/>
  </g>`;
}

export function boardArt(layout) {
  return `<svg class="sl-art" viewBox="0 0 1000 1000" aria-hidden="true" preserveAspectRatio="none">
    ${layout.ladders.map(ladderShape).join('')}${layout.snakes.map(snakeShape).join('')}
  </svg>`;
}
