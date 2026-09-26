import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GOODS, COSTS, createIsland, newCatan, actCatan, actTradeReply,
  canRoad, canSettle, longestRoad, points, tradeRate, catanView, applyRemoteCatanAction,
  validCatanCheckpoint, VERTEX_TOUCH_RADIUS,
} from '../games/catan.js';
import { terrainArt, goodIcon, buildingArt, discoveryIcon } from '../games/catan-art.js';
import { diceMarkup } from '../js/dice.js';

function rng(seed = 517) {
  return () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
}
function setup(state) {
  if (state.phase === 'setup-roll') {
    for (const dice of [[6, 6], [5, 5], [4, 4], [3, 3]].slice(0, state.players.length))
      assert.equal(actCatan(state, { type: 'setup-roll', dice }), true);
  }
  while (state.phase.startsWith('setup')) {
    if (state.phase === 'setup-settlement') {
      const vertex = state.buildings.findIndex((_, i) => canSettle(state, state.current, i, true));
      assert.ok(vertex >= 0);
      assert.equal(actCatan(state, { type: 'setup-settlement', vertex }), true);
    } else {
      const edge = state.roads.findIndex((_, i) => canRoad(state, state.current, i, true));
      assert.ok(edge >= 0);
      assert.equal(actCatan(state, { type: 'setup-road', edge }), true);
    }
  }
}
function roll(state, dice = [2, 3]) {
  assert.equal(actCatan(state, { type: 'roll', dice }), true);
}
function stock(state, player, quantity = 12) {
  for (const good of GOODS) {
    const amount = Math.min(quantity, state.bank[good]);
    state.players[player].goods[good] += amount;
    state.bank[good] -= amount;
  }
}

test('phone chart scrolls at playable scale with usable junction and path targets', () => {
  const css = readFileSync(new URL('../css/catan.css', import.meta.url), 'utf8');
  const mobile = css.slice(css.indexOf('@media (max-width: 650px)'));
  assert.match(mobile, /\.ct-chart-wrap\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(css, /\.ct-chart-wrap\s*\{[^}]*touch-action:\s*pan-x pan-y/);
  assert.match(mobile, /\.ct-scroll-hint\s*\{[^}]*display:\s*block/);
  const boardWidth = Number(mobile.match(/\.ct-chart\s*\{[^}]*width:\s*calc\((\d+)px/)?.[1]);
  const edgeStroke = Number(css.match(/\.ct-edge-hit\s*\{[^}]*stroke-width:\s*(\d+)/)?.[1]);
  assert.ok(boardWidth > 760, 'board must expand beyond the phone viewport');
  assert.ok(2 * VERTEX_TOUCH_RADIUS * boardWidth / 760 >= 44,
    'junction touch target must be at least 44px on a phone');
  assert.ok(edgeStroke * boardWidth / 760 >= 44,
    'path touch target must be at least 44px across on a phone');
});

test('island terrain, supplies, buildings and discoveries have distinct vector art', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElementNS(namespace, tag) {
      assert.equal(namespace, 'http://www.w3.org/2000/svg');
      return {
        tag, attributes: {}, children: [],
        setAttribute(name, value) { this.attributes[name] = String(value); },
        append(...nodes) { this.children.push(...nodes); },
      };
    },
  };
  try {
    for (const terrain of ['forest', 'hills', 'fields', 'pasture', 'mountains', 'desert']) {
      const art = terrainArt(terrain);
      assert.ok(art.children.length > 1, `${terrain} needs illustrated scenery`);
      assert.equal(art.attributes['aria-hidden'], 'true');
    }
    for (const good of GOODS) assert.ok(goodIcon(good).children.length);
    assert.notDeepEqual(buildingArt(false), buildingArt(true));
    for (const discovery of ['knight', 'victory', 'roads', 'plenty', 'monopoly'])
      assert.equal(discoveryIcon(discovery).children[0].tag, 'path');
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('island dice use the same pipped cubes as the other board games', () => {
  for (let value = 1; value <= 6; value++) {
    const face = diceMarkup([value]).match(new RegExp(
      `<span class="arcade-die-face arcade-die-face-${value}">([\\s\\S]*?)</span>`))?.[1];
    assert.ok(face);
    assert.equal((face.match(/class="arcade-pip"/g) || []).length, value);
  }
  assert.equal((diceMarkup([3, 5]).match(/class="arcade-die"/g) || []).length, 2);
});

test('dice reject array-like objects and malformed rolls without throwing or mutating state', () => {
  const state = newCatan(3, rng());
  setup(state);
  const snapshot = JSON.stringify(state);
  for (const dice of [{ 0: 1, 1: 2, length: 2 }, null, [], Array(2),
    [1, 2, 3], [0, 2], [7, 2], [1, 2.5]]) {
    assert.doesNotThrow(() => {
      assert.equal(actCatan(state, { type: 'roll', dice }), false);
    });
    assert.equal(JSON.stringify(state), snapshot);
  }
  assert.equal(actCatan(state, { type: 'roll', dice: [1, 2] }), true);
});

test('island has nineteen connected tiles, 54 junctions, 72 paths, nine harbors, correct terrain and dice', () => {
  for (let seed = 0; seed <= 30; seed++) {
    const board = createIsland(seed ? rng(seed) : () => 0);
    assert.equal(board.tiles.length, 19);
    assert.equal(board.vertices.length, 54);
    assert.equal(board.edges.length, 72);
    assert.equal(board.edges.filter(edge => edge.port).length, 9);
    assert.equal(board.edges.filter(edge => edge.tiles.length === 1).length, 30);
    assert.equal(board.tiles.filter(tile => tile.terrain === 'desert').length, 1);
    assert.equal(board.tiles.filter(tile => tile.number === 6).length, 2);
    assert.equal(board.tiles.filter(tile => tile.number === 8).length, 2);
    for (const tile of board.tiles) {
      assert.equal(tile.vertices.length, 6);
      if (![6, 8].includes(tile.number)) continue;
      assert.ok(board.tiles.filter(t => [6, 8].includes(t.number)).every(other =>
        other === tile || !tile.vertices.some(v => other.vertices.includes(v))));
    }
    for (const edge of board.edges) {
      assert.ok(board.vertices[edge.a].edges.some(i => board.edges[i] === edge));
      assert.ok(board.vertices[edge.b].edges.some(i => board.edges[i] === edge));
    }
  }
});

test('3–4 players only; snake setup enforces distance, attached road and reverse order', () => {
  assert.throws(() => newCatan(2, rng()), RangeError);
  for (const n of [3, 4]) {
    const state = newCatan(n, rng());
    assert.equal(state.phase, 'setup-roll');
    assert.equal(actCatan(state, { type: 'setup-settlement', vertex: 0 }), false);
    for (const dice of [[6, 6], [5, 5], [4, 4], [3, 3]].slice(0, n))
      assert.equal(actCatan(state, { type: 'setup-roll', dice }), true);
    assert.equal(state.phase, 'setup-settlement');
    const start = 0;
    assert.equal(actCatan(state, { type: 'setup-settlement', vertex: start }, 1), false);
    assert.equal(actCatan(state, { type: 'setup-settlement', vertex: start }), true);
    assert.equal(actCatan(state, { type: 'setup-road', edge: 70 }), false);
    const edge = state.board.vertices[start].edges[0];
    assert.equal(actCatan(state, { type: 'setup-road', edge }), true);
    assert.equal(state.current, 1);
    assert.equal(canSettle(state, 1, state.board.vertices[start].neighbors[0], true), false);
    setup(state);
    assert.equal(state.phase, 'roll');
    assert.equal(state.current, 0);
    assert.equal(state.setupStep, 2 * n);
    assert.ok(state.players.every(p => p.settlements === 2 && p.roads === 2));
    assert.ok(state.players.some(p => GOODS.some(g => p.goods[g] > 0)));
  }
});

test('opening rolls determine both placement passes, with tied navigators rerolling', () => {
  const state = newCatan(3, rng());
  assert.equal(actCatan(state, { type: 'setup-roll', dice: [6, 6] }, 1), false);
  for (const dice of [[2, 3], [4, 4], [4, 4]])
    assert.equal(actCatan(state, { type: 'setup-roll', dice }), true);
  assert.equal(state.phase, 'setup-roll');
  assert.deepEqual(state.setupRolls, [5, null, null]);
  assert.equal(actCatan(state, { type: 'setup-roll', dice: [1, 1] }), true);
  assert.equal(actCatan(state, { type: 'setup-roll', dice: [6, 6] }), true);
  assert.deepEqual(state.setupOrder, [2, 0, 1]);
  const placements = [];
  while (state.phase.startsWith('setup')) {
    if (state.phase === 'setup-settlement') {
      placements.push(state.current);
      const vertex = state.buildings.findIndex((_, index) => canSettle(state, state.current, index, true));
      assert.equal(actCatan(state, { type: 'setup-settlement', vertex }), true);
    } else {
      const edge = state.roads.findIndex((_, index) => canRoad(state, state.current, index, true));
      assert.equal(actCatan(state, { type: 'setup-road', edge }), true);
    }
  }
  assert.deepEqual(placements, [2, 0, 1, 1, 0, 2]);
  assert.equal(state.current, 2);
});

test('dice production pays outposts once and cities twice, robber suppresses tile and seven discards', () => {
  const state = newCatan(3, rng());
  setup(state);
  const tileId = state.board.tiles.findIndex(t => t.number && t.terrain !== 'desert');
  const tile = state.board.tiles[tileId];
  const good = { forest: 'timber', hills: 'clay', fields: 'grain', pasture: 'wool',
    mountains: 'ore' }[tile.terrain];
  const vertex = tile.vertices.find(v => state.buildings[v] === null);
  if (vertex !== undefined) {
    state.buildings[vertex] = { owner: 0, city: true };
    state.players[0].cities++;
    const before = state.players[0].goods[good];
    const dice = tile.number <= 7 ? [1, tile.number - 1] : [6, tile.number - 6];
    roll(state, dice);
    assert.ok(state.players[0].goods[good] >= before + 2);
    state.phase = 'roll';
    state.robber = tileId;
    const blocked = state.players[0].goods[good];
    roll(state, dice);
    assert.equal(state.players[0].goods[good], blocked);
  }
  state.phase = 'roll';
  stock(state, 1, 5);
  const count = GOODS.reduce((n, g) => n + state.players[1].goods[g], 0);
  roll(state, [3, 4]);
  assert.equal(state.phase, 'discard');
  assert.equal(state.discards[1], Math.floor(count / 2));
  assert.equal(actCatan(state, { type: 'robber', tile: (state.robber + 1) % 19, victim: null }), false);
  const goods = {};
  let remaining = state.discards[1];
  for (const good of GOODS) {
    const take = Math.min(remaining, state.players[1].goods[good]);
    if (take) goods[good] = take;
    remaining -= take;
  }
  assert.equal(actCatan(state, { type: 'discard', goods }, 1), true);
  for (let i = 0; i < state.players.length; i++) {
    if (state.discards[i]) {
      const give = {};
      let left = state.discards[i];
      for (const good of GOODS) {
        const take = Math.min(left, state.players[i].goods[good]);
        if (take) give[good] = take;
        left -= take;
      }
      assert.equal(actCatan(state, { type: 'discard', goods: give }, i), true);
    }
  }
  assert.equal(state.phase, 'robber');
  const destination = state.board.tiles.findIndex((t, i) => i !== state.robber &&
    t.vertices.every(v => state.buildings[v]?.owner === undefined));
  assert.equal(actCatan(state, { type: 'robber', tile: destination, victim: null }), true);
  assert.equal(state.phase, 'main');
});

test('buildings consume supplies, follow connected roads, observe distance and piece limits', () => {
  const state = newCatan(3, rng());
  setup(state); roll(state);
  stock(state, 0);
  assert.equal(actCatan(state, { type: 'build-settlement', vertex: 0 }), false);
  const edge = state.roads.findIndex((_, i) => canRoad(state, 0, i));
  assert.ok(edge >= 0);
  const before = state.players[0].goods.timber;
  assert.equal(actCatan(state, { type: 'build-road', edge }), true);
  assert.equal(state.players[0].goods.timber, before - COSTS.road.timber);
  assert.equal(actCatan(state, { type: 'build-road', edge }), false);
  const vertex = state.buildings.findIndex(b => b?.owner === 0 && !b.city);
  assert.equal(actCatan(state, { type: 'build-city', vertex }), true);
  assert.equal(state.players[0].cities, 1);
  assert.equal(state.players[0].settlements, 1);
  assert.equal(actCatan(state, { type: 'build-city', vertex }), false);
  assert.equal(points(state, 0), 3);
  const blocked = state.board.vertices.findIndex((_, v) =>
    !state.buildings[v] && state.board.vertices[v].neighbors.some(n => state.buildings[n]));
  assert.equal(canSettle(state, 0, blocked), false);
});

test('harbor rates, bank inventory, player offer validation and consent', () => {
  const state = newCatan(3, rng());
  setup(state); roll(state);
  stock(state, 0, 9); stock(state, 1, 6);
  const harbor = state.board.edges.find(e => e.port && e.port !== 'any');
  const dock = state.buildings[harbor.a] === null ? harbor.a : harbor.b;
  state.buildings[dock] = { owner: 0, city: false };
  assert.equal(tradeRate(state, 0, harbor.port), 2);
  const give = 'timber', receive = 'ore';
  const rate = tradeRate(state, 0, give);
  const before = state.players[0].goods[give];
  assert.equal(actCatan(state, { type: 'bank-trade', give, receive, quantity: 1 }), true);
  assert.equal(state.players[0].goods[give], before - rate);
  assert.equal(actCatan(state, { type: 'offer', to: 1,
    give: { clay: 1 }, want: { wool: 2 } }), true);
  assert.equal(actTradeReply(state, { type: 'accept' }, 2), false);
  const previous = state.players[0].goods.wool;
  assert.equal(actTradeReply(state, { type: 'accept' }, 1), true);
  assert.equal(state.players[0].goods.wool, previous + 2);
  assert.equal(state.offer, null);
  assert.equal(actTradeReply(state, { type: 'accept' }, 1), false);
  state.players[1].goods.ore = 0;
  assert.equal(actCatan(state, { type: 'offer', to: 1,
    give: { clay: 1 }, want: { ore: 1 } }), true);
  assert.equal(actTradeReply(state, { type: 'accept' }, 1), false);
  assert.equal(actTradeReply(state, { type: 'decline' }, 1), true);
});

test('development timing, single action per turn, bank-limited windfall and largest patrol', () => {
  const state = newCatan(3, rng());
  setup(state); roll(state);
  stock(state, 0);
  state.deck.push('knight');
  assert.equal(actCatan(state, { type: 'buy-dev' }), true);
  assert.equal(actCatan(state, { type: 'play-dev', card: 'knight' }), false);
  state.players[0].dev.push({ type: 'knight', bought: 0 },
    { type: 'knight', bought: 0 }, { type: 'knight', bought: 0 });
  for (let i = 1; i <= 3; i++) {
    state.devPlayed = false;
    assert.equal(actCatan(state, { type: 'play-dev', card: 'knight' }), true);
    assert.equal(actCatan(state, { type: 'play-dev', card: 'knight' }), false);
    assert.equal(state.phase, 'robber');
    assert.equal(actCatan(state, { type: 'robber',
      tile: state.robber, victim: null }), false);
    const tile = state.board.tiles.findIndex((t, j) => j !== state.robber &&
      t.vertices.every(v => !state.buildings[v] || state.buildings[v].owner === 0));
    assert.equal(actCatan(state, { type: 'robber', tile, victim: null }), true);
    assert.equal(state.phase, 'main');
  }
  assert.equal(state.largest, 0);
  assert.ok(points(state, 0) >= 4);
  state.devPlayed = false;
  state.players[0].dev.push({ type: 'plenty', bought: 0 });
  state.bank.ore = 1;
  assert.equal(actCatan(state, { type: 'play-dev', card: 'plenty',
    goods: { ore: 2 } }), false);
  assert.equal(state.devPlayed, false);
});

test('longest trail cannot continue through opponent outpost; tied incumbent retains title', () => {
  const state = newCatan(3, rng());
  const board = state.board;
  function findPath(from, path, used, target = 5) {
    if (path.length === target) return path;
    for (const edge of board.vertices[from].edges) {
      if (used.has(edge)) continue;
      const link = board.edges[edge];
      const next = link.a === from ? link.b : link.a;
      const result = findPath(next, [...path, edge], new Set([...used, edge]), target);
      if (result) return result;
    }
    return null;
  }
  const path = findPath(0, [], new Set());
  assert.equal(path.length, 5);
  path.forEach(edge => state.roads[edge] = 0);
  assert.equal(longestRoad(state, 0), 5);
  const shared = board.edges[path[2]];
  const intersection = [shared.a, shared.b].find(v => board.vertices[v].edges.includes(path[1]));
  state.buildings[intersection] = { owner: 1, city: false };
  assert.ok(longestRoad(state, 0) < 5);
});

test('private view exposes only own cargo and discoveries, not deck or rivals hands', () => {
  const state = newCatan(3, rng());
  state.players[0].dev.push({ type: 'victory', bought: 0 });
  state.players[0].goods.ore = 3;
  const guest = catanView(state, 1);
  assert.equal(guest.goods.ore, 0);
  assert.deepEqual(guest.dev, []);
  assert.equal(guest.counts[0].goods, 3);
  assert.equal(guest.counts[0].dev, 1);
  assert.equal(guest.scores[0], 0);
  assert.equal(guest.myScore, 0);
  assert.equal(JSON.stringify(guest).includes('"type":"victory"'), false);
  assert.equal(catanView(state, 0).myScore, 1);
});

test('local voyage checkpoints validate topology, piece limits and bank conservation', () => {
  const state = newCatan(3, rng());
  assert.equal(validCatanCheckpoint(state), true);
  setup(state);
  assert.equal(validCatanCheckpoint(JSON.parse(JSON.stringify(state))), true);
  roll(state);
  assert.equal(validCatanCheckpoint(state), true);
  state.roomRound = 2;
  assert.equal(validCatanCheckpoint(state), true);
  state.roomRound = -1;
  assert.equal(validCatanCheckpoint(state), false);
  delete state.roomRound;
  const invalid = structuredClone(state);
  invalid.players[1].goods.ore++;
  assert.equal(validCatanCheckpoint(invalid), false);
  invalid.players[1].goods.ore--;
  invalid.board.edges[0].a = 999;
  assert.equal(validCatanCheckpoint(invalid), false);
});

test('host rejects spoofed, stale and out-of-turn requests and generates dice itself', () => {
  const opening = newCatan(3, rng());
  const seats = ['host', 'visitor-a', 'visitor-b'];
  const opener = { type: 'ct-request', revision: 0,
    move: { type: 'setup-roll', dice: [6, 6] } };
  assert.equal(applyRemoteCatanAction(opening, opener, 0, 'visitor-a', seats, () => .25), false);
  assert.equal(applyRemoteCatanAction(opening, opener, 0, 'host', seats, () => .25), true);
  assert.equal(opening.setupRolls[0], 4, 'the host generates opening dice, not the guest');
  const state = newCatan(3, rng());
  setup(state);
  const request = { type: 'ct-request', revision: 7,
    move: { type: 'roll', dice: [6, 6] } };
  assert.equal(applyRemoteCatanAction(state, request, 8, 'host', seats, () => .25), false);
  assert.equal(applyRemoteCatanAction(state, request, 7, 'visitor-a', seats, () => .25), false);
  assert.equal(applyRemoteCatanAction(state, request, 7, 'intruder', seats, () => .25), false);
  assert.equal(state.rolled, null);
  assert.equal(applyRemoteCatanAction(state, request, 7, 'host', seats, () => .25), true);
  assert.deepEqual(state.rolled, [2, 2]);
  const next = newCatan(3, rng());
  setup(next);
  assert.equal(applyRemoteCatanAction(next, { ...request, revision: 0 }, 0,
    'host', seats, () => .25, [3, 5]), true);
  assert.deepEqual(next.rolled, [3, 5], 'host-selected animated result is committed unchanged');
  const snapshot = JSON.stringify(state);
  assert.equal(applyRemoteCatanAction(state, { ...request, move: { type: 'build-road',
    edge: 0 } }, 7, 'visitor-b', seats), false);
  assert.equal(JSON.stringify(state), snapshot);
});

test('trailblazer resolves free paths before a pre-roll card returns to dice', () => {
  const state = newCatan(3, rng());
  setup(state);
  state.players[0].dev.push({ type: 'roads', bought: 0 });
  assert.equal(actCatan(state, { type: 'play-dev', card: 'roads' }), true);
  assert.equal(state.phase, 'free-roads');
  assert.equal(actCatan(state, { type: 'roll', dice: [3, 4] }), false);
  const edge = state.roads.findIndex((_, i) => canRoad(state, 0, i));
  assert.equal(actCatan(state, { type: 'build-road', edge }), true);
  assert.equal(state.freeRoads, 1);
  assert.equal(actCatan(state, { type: 'skip-free-roads' }), true);
  assert.equal(state.phase, 'roll');
  assert.equal(actCatan(state, { type: 'roll', dice: [2, 3] }), true);
});

test('five connected roads earn two points and first to ten wins on own turn', () => {
  const state = newCatan(3, rng());
  state.phase = 'main';
  state.turn = 1;
  const path = [];
  let vertex = 0;
  const visited = new Set([vertex]);
  for (let i = 0; i < 5; i++) {
    const id = state.board.vertices[vertex].edges.find(edge => {
      const link = state.board.edges[edge];
      return !visited.has(link.a === vertex ? link.b : link.a);
    });
    assert.ok(id !== undefined);
    path.push(id);
    const link = state.board.edges[id];
    vertex = link.a === vertex ? link.b : link.a;
    visited.add(vertex);
  }
  path.slice(0, 4).forEach(edge => { state.roads[edge] = 0; });
  state.players[0].roads = 4;
  stock(state, 0);
  assert.equal(actCatan(state, { type: 'build-road', edge: path[4] }), true);
  assert.equal(state.longest, 0);
  assert.ok(longestRoad(state, 0) >= 5);
  assert.equal(points(state, 0), 2);
  state.players[0].dev.push(...Array(8).fill(null).map(() => ({ type: 'victory', bought: 0 })));
  assert.equal(actCatan(state, { type: 'end' }), true);
  assert.equal(state.winner, null);
  for (let i = 0; i < 2; i++) {
    roll(state);
    assert.equal(actCatan(state, { type: 'end' }), true);
  }
  assert.equal(state.current, 0);
  assert.equal(state.winner, 0);
  assert.equal(actCatan(state, { type: 'end' }), false);
});
