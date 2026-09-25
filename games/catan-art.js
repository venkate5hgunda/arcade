const NS = 'http://www.w3.org/2000/svg';

export function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

const shape = (parent, tag, attrs) => parent.append(svg(tag, attrs));

export function terrainArt(terrain, x = 0, y = 0, scale = 1) {
  const art = svg('g', { class: `ct-art ct-art--${terrain}`,
    transform: `translate(${x} ${y}) scale(${scale})`, 'aria-hidden': 'true', 'pointer-events': 'none' });
  switch (terrain) {
    case 'forest':
      for (const [tx, ty, size] of [[-24, 6, .8], [3, 10, 1], [25, 7, .75]]) {
        const tree = svg('g', { transform: `translate(${tx} ${ty}) scale(${size})` });
        shape(tree, 'rect', { x: -4, y: 6, width: 8, height: 22, rx: 2, fill: '#604b34' });
        shape(tree, 'path', { d: 'M0 -33 17 -2h-7l12 20H-22l12-20h-7Z',
          fill: '#173f38', stroke: '#abe3af', 'stroke-width': 2, 'stroke-linejoin': 'round' });
        shape(tree, 'path', { d: 'M0 -25v30', stroke: '#78b687', 'stroke-width': 2 });
        art.append(tree);
      }
      break;
    case 'hills':
      shape(art, 'path', { d: 'M-43 25 Q-20 -21 0 13 Q19 -32 45 25Z', fill: '#a34939',
        stroke: '#ffbd80', 'stroke-width': 2 });
      shape(art, 'path', { d: 'M-47 27 Q-17 1 5 26 Q27 1 47 24', fill: 'none',
        stroke: '#ffce95', 'stroke-width': 4 });
      for (const [bx, by] of [[-17, 11], [9, 8], [27, 18]])
        shape(art, 'rect', { x: bx, y: by, width: 10, height: 7, rx: 1, fill: '#ee9865' });
      break;
    case 'fields':
      for (const [wx, bend] of [[-26, -4], [-12, 2], [2, -2], [16, 4], [30, -3]]) {
        shape(art, 'path', { d: `M${wx} 28 Q${wx + bend} -1 ${wx} -28`, fill: 'none',
          stroke: '#775b27', 'stroke-width': 2.5, 'stroke-linecap': 'round' });
        for (const n of [-17, -9, -1])
          for (const side of [-1, 1])
            shape(art, 'ellipse', { cx: wx + side * 5 + bend * .4, cy: n,
              rx: 3, ry: 7, transform: `rotate(${side * 33} ${wx + side * 5 + bend * .4} ${n})`,
              fill: '#fff1af' });
      }
      break;
    case 'pasture':
      for (const [sx, sy, size] of [[-19, 5, .8], [17, 1, 1]]) {
        const sheep = svg('g', { transform: `translate(${sx} ${sy}) scale(${size})` });
        shape(sheep, 'path', { d: 'M-15 9v16m21-16v16', stroke: '#545951',
          'stroke-width': 4, 'stroke-linecap': 'round' });
        for (const [cx, cy] of [[-9, 0], [0, -5], [10, -2], [-1, 7]])
          shape(sheep, 'circle', { cx, cy, r: 10, fill: '#fff8dc', stroke: '#b7c5a6', 'stroke-width': 2 });
        shape(sheep, 'ellipse', { cx: 16, cy: 8, rx: 8, ry: 9, fill: '#534f49' });
        shape(sheep, 'circle', { cx: 19, cy: 5, r: 1.6, fill: '#fff8dc' });
        art.append(sheep);
      }
      break;
    case 'mountains':
      shape(art, 'path', { d: 'M-45 28-14-29 4 2 18-22 46 28Z', fill: '#495e68',
        stroke: '#c5d5ce', 'stroke-width': 2, 'stroke-linejoin': 'round' });
      shape(art, 'path', { d: 'm-26-7 12-22L0-6l-13-9Zm30 9 14-24L30 0 19-8Z', fill: '#f1e8d4' });
      shape(art, 'path', { d: 'M-32 23-12 5M11 19 29 7', stroke: '#97aeb2', 'stroke-width': 2 });
      break;
    case 'desert':
      shape(art, 'circle', { cx: 18, cy: -22, r: 11, fill: '#fff1b1' });
      shape(art, 'path', { d: 'M-45 20Q-17-18 5 18Q24-3 46 21v10H-45Z', fill: '#d3a969' });
      shape(art, 'path', { d: 'M-45 27Q-16 3 7 27Q29 7 46 26', fill: 'none',
        stroke: '#ffe2a6', 'stroke-width': 3 });
      break;
    default:
      throw new RangeError(`Unknown island terrain: ${terrain}`);
  }
  return art;
}

const TERRAIN_FOR_GOOD = { timber: 'forest', clay: 'hills', grain: 'fields',
  wool: 'pasture', ore: 'mountains' };

export function goodIcon(good) {
  const icon = svg('svg', { class: `ct-icon ct-icon--${good}`, viewBox: '-48 -48 96 96',
    'aria-hidden': 'true', focusable: 'false' });
  icon.append(terrainArt(TERRAIN_FOR_GOOD[good], 0, 0, 1));
  return icon;
}

export function buildingArt(city = false) {
  const art = svg('g', { class: 'ct-building', 'aria-hidden': 'true', 'pointer-events': 'none' });
  shape(art, 'circle', { r: city ? 19 : 16, class: 'ct-building-base' });
  shape(art, 'path', { d: city ? 'M-13 10V-5l5-4 5 4v-10h7v10l5-4 5 4v15Z' :
    'M-12 1 0-12 12 1v11h-24Z', class: 'ct-building-wall' });
  if (!city) shape(art, 'path', { d: 'M-14 0 0-14 14 0', class: 'ct-building-roof' });
  shape(art, 'path', { d: 'M-3 11V3h6v8', class: 'ct-building-door' });
  return art;
}

const PIPS = {
  1: [[0, 0]], 2: [[-7, -7], [7, 7]], 3: [[-7, -7], [0, 0], [7, 7]],
  4: [[-7, -7], [7, -7], [-7, 7], [7, 7]],
  5: [[-7, -7], [7, -7], [0, 0], [-7, 7], [7, 7]],
  6: [[-7, -8], [7, -8], [-7, 0], [7, 0], [-7, 8], [7, 8]],
};

export function dieFace(value) {
  if (!PIPS[value]) throw new RangeError(`Invalid die: ${value}`);
  const die = svg('svg', { class: 'ct-die', viewBox: '-19 -19 38 38',
    'aria-hidden': 'true', focusable: 'false' });
  shape(die, 'rect', { x: -17, y: -17, width: 34, height: 34, rx: 6 });
  for (const [cx, cy] of PIPS[value]) shape(die, 'circle', { cx, cy, r: 2.6 });
  return die;
}

const DISCOVERY_PATH = {
  knight: 'M16 3 26 7v9c0 6-4 10-10 13C10 26 6 22 6 16V7Z',
  victory: 'm16 3 3.2 8.5 9 .6-7 5.5 2.3 9-7.5-5-7.5 5 2.3-9-7-5.5 9-.6Z',
  roads: 'M3 26Q13 23 9 16T18 8Q22 5 29 5M23 3l6 2-3 6',
  plenty: 'M4 11q12-12 24 0v16H4Zm0 4h24M10 15v12m12-12v12',
  monopoly: 'M16 3v26m-9-21h18m-18 0-5 9h10Zm18 0-5 9h10Zm-16 21h14',
};

export function discoveryIcon(type) {
  if (!DISCOVERY_PATH[type]) throw new RangeError(`Unknown discovery: ${type}`);
  const icon = svg('svg', { class: `ct-icon ct-icon--${type}`, viewBox: '0 0 32 32',
    'aria-hidden': 'true', focusable: 'false' });
  shape(icon, 'path', { d: DISCOVERY_PATH[type], fill: 'none',
    stroke: 'currentColor', 'stroke-width': 2.3, 'stroke-linecap': 'round',
    'stroke-linejoin': 'round' });
  return icon;
}
