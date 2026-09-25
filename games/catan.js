import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { remoteMatch, seat } from '../js/remote-match.js';
import { playerName } from '../js/player-names.js';
import { celebrate } from '../js/celebration.js';
import { createTurnIndicator } from '../js/turn-indicator.js';

export const GOODS = ['timber', 'clay', 'grain', 'wool', 'ore'];
export const VERTEX_TOUCH_RADIUS = 22;
export const COSTS = {
  road: { timber: 1, clay: 1 },
  settlement: { timber: 1, clay: 1, grain: 1, wool: 1 },
  city: { grain: 2, ore: 3 },
  development: { grain: 1, wool: 1, ore: 1 },
};
export const COLORS = ['#eb805b', '#63c7b7', '#e7b759', '#9a8ad6'];
const TERRAIN = ['forest', 'forest', 'forest', 'forest', 'hills', 'hills', 'hills',
  'fields', 'fields', 'fields', 'fields', 'pasture', 'pasture', 'pasture', 'pasture',
  'mountains', 'mountains', 'mountains', 'desert'];
const YIELDS = { forest: 'timber', hills: 'clay', fields: 'grain', pasture: 'wool', mountains: 'ore' };
const NUMBERS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
const DECK = [...Array(14).fill('knight'), ...Array(5).fill('victory'),
  ...Array(2).fill('roads'), ...Array(2).fill('plenty'), ...Array(2).fill('monopoly')];
const SUM = o => GOODS.reduce((n, good) => n + (o?.[good] || 0), 0);
const emptyGoods = () => Object.fromEntries(GOODS.map(g => [g, 0]));
const isGood = g => GOODS.includes(g);
const integer = (n, low = 0) => Number.isSafeInteger(n) && n >= low;
const validGoods = o => o && typeof o === 'object' &&
  Object.keys(o).every(g => isGood(g) && integer(o[g])) && SUM(o) > 0;
const shuffled = (items, random) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export function createIsland(random = Math.random) {
  const coords = [];
  for (let row = -2; row <= 2; row++)
    for (let q = -2; q <= 2; q++)
      if (Math.abs(q + row) <= 2) coords.push([q, row]);
  const adjacent = coords.map(([q, row], i) => coords.flatMap(([x, y], j) =>
    j !== i && Math.max(Math.abs(q - x), Math.abs(row - y), Math.abs(q + row - x - y)) === 1 ? [j] : []));
  const terrains = shuffled(TERRAIN, random);
  const candidates = shuffled(coords.flatMap((_, i) => terrains[i] === 'desert' ? [] : [i]), random);
  const chooseHot = (chosen, offset) => {
    if (chosen.length === 4) return chosen;
    for (let i = offset; i < candidates.length; i++) {
      const tile = candidates[i];
      if (chosen.some(j => adjacent[j].includes(tile))) continue;
      const result = chooseHot([...chosen, tile], i + 1);
      if (result) return result;
    }
    return null;
  };
  const hot = chooseHot([], 0);
  const hotNumbers = shuffled([6, 6, 8, 8], random);
  const numbers = shuffled(NUMBERS.filter(n => n !== 6 && n !== 8), random);
  const tiles = coords.map(([q, row], i) => ({
    q, row, terrain: terrains[i],
    number: terrains[i] === 'desert' ? null :
      hot.includes(i) ? hotNumbers[hot.indexOf(i)] : numbers.shift(),
    vertices: [],
  }));
  const vertices = [], edges = [], vertexByPosition = new Map(), edgeByEnds = new Map();
  tiles.forEach((tile, tileId) => {
    const cx = 380 + Math.sqrt(3) * 69 * (tile.q + tile.row / 2);
    const cy = 350 + 103.5 * tile.row;
    for (let k = 0; k < 6; k++) {
      const angle = Math.PI * (k * 60 - 90) / 180;
      const x = cx + 69 * Math.cos(angle), y = cy + 69 * Math.sin(angle);
      const key = `${Math.round(x * 100)},${Math.round(y * 100)}`;
      if (!vertexByPosition.has(key)) {
        vertexByPosition.set(key, vertices.length);
        vertices.push({ x, y, tiles: [], edges: [], neighbors: [], port: null });
      }
      const id = vertexByPosition.get(key);
      tile.vertices.push(id);
      vertices[id].tiles.push(tileId);
    }
    for (let k = 0; k < 6; k++) {
      const a = tile.vertices[k], b = tile.vertices[(k + 1) % 6];
      const key = [a, b].sort((x, y) => x - y).join(':');
      if (!edgeByEnds.has(key)) {
        edgeByEnds.set(key, edges.length);
        edges.push({ a, b, tiles: [], port: null });
        vertices[a].edges.push(edges.length - 1);
        vertices[b].edges.push(edges.length - 1);
        vertices[a].neighbors.push(b);
        vertices[b].neighbors.push(a);
      }
      edges[edgeByEnds.get(key)].tiles.push(tileId);
    }
  });
  // Distribute nine harbors evenly around the coast, leaving at least one edge between docks.
  const boundary = edges.flatMap((edge, i) => edge.tiles.length === 1 ? [i] : []);
  const neighbors = i => boundary.filter(j => j !== i &&
    [edges[i].a, edges[i].b].some(v => v === edges[j].a || v === edges[j].b));
  const ordered = [boundary[0]];
  while (ordered.length < boundary.length) {
    const candidates = neighbors(ordered.at(-1)).filter(i => !ordered.includes(i));
    if (!candidates.length) break;
    ordered.push(candidates.find(i => i !== ordered.at(-2)) ?? candidates[0]);
  }
  const ports = shuffled(['any', 'any', 'any', 'any', 'timber', 'clay', 'grain', 'wool', 'ore'], random);
  for (let i = 0; i < 9; i++) {
    const edge = edges[ordered[(i * 3) % ordered.length]];
    edge.port = ports[i];
    vertices[edge.a].port = ports[i];
    vertices[edge.b].port = ports[i];
  }
  return { tiles, vertices, edges };
}

export function newCatan(count = 3, random = Math.random) {
  if (!integer(count, 3) || count > 4) throw new RangeError('Island Charter needs 3–4 players.');
  const board = createIsland(random);
  return {
    board, buildings: Array(board.vertices.length).fill(null),
    roads: Array(board.edges.length).fill(null),
    players: Array.from({ length: count }, () => ({
      goods: emptyGoods(), dev: [], roads: 0, settlements: 0, cities: 0, knights: 0,
    })),
    bank: Object.fromEntries(GOODS.map(g => [g, 19])),
    deck: shuffled(DECK, random), robber: board.tiles.findIndex(t => t.terrain === 'desert'),
    current: 0, setupStep: 0, setupVertex: null, phase: 'setup-settlement',
    rolled: null, discards: [], robberReturn: 'main', freeRoads: 0,
    devPlayed: false, turn: 0, longest: null, largest: null, offer: null,
    roadsReturn: 'main',
    winner: null, message: 'Place your first outpost.',
  };
}

export function longestRoad(state, player) {
  const roads = state.roads.flatMap((owner, id) => owner === player ? [id] : []);
  let best = 0;
  const walk = (vertex, used) => {
    best = Math.max(best, used.size);
    if (used.size && state.buildings[vertex] && state.buildings[vertex].owner !== player) return;
    for (const id of state.board.vertices[vertex].edges) {
      if (state.roads[id] !== player || used.has(id)) continue;
      used.add(id);
      const edge = state.board.edges[id];
      walk(edge.a === vertex ? edge.b : edge.a, used);
      used.delete(id);
    }
  };
  for (const id of roads) {
    const used = new Set();
    walk(state.board.edges[id].a, used);
    walk(state.board.edges[id].b, used);
  }
  return best;
}

function award(state, key, values, threshold) {
  const max = Math.max(...values);
  const leaders = values.flatMap((n, i) => n === max ? [i] : []);
  state[key] = max < threshold ? null :
    leaders.includes(state[key]) ? state[key] : leaders.length === 1 ? leaders[0] : null;
}
export function points(state, player) {
  const p = state.players[player];
  return p.settlements + 2 * p.cities + p.dev.filter(c => c.type === 'victory').length +
    2 * (state.longest === player) + 2 * (state.largest === player);
}
function updateAwards(state) {
  award(state, 'longest', state.players.map((_, i) => longestRoad(state, i)), 5);
  award(state, 'largest', state.players.map(p => p.knights), 3);
  if (!['setup-settlement', 'setup-road', 'discard', 'robber', 'free-roads'].includes(state.phase) &&
      points(state, state.current) >= 10) {
    state.winner = state.current;
    state.message = `Player ${state.current + 1} founded a flourishing island!`;
  }
}
function hasGoods(p, cost) {
  return GOODS.every(g => p.goods[g] >= (cost[g] || 0));
}
function pay(state, player, cost) {
  for (const g of GOODS) {
    state.players[player].goods[g] -= cost[g] || 0;
    state.bank[g] += cost[g] || 0;
  }
}
function transfer(state, player, cost) {
  for (const g of GOODS) {
    state.players[player].goods[g] += cost[g] || 0;
    state.bank[g] -= cost[g] || 0;
  }
}
export function canSettle(state, player, vertex, setup = false) {
  if (!integer(vertex) || vertex >= state.buildings.length || state.buildings[vertex] ||
      state.board.vertices[vertex].neighbors.some(n => state.buildings[n])) return false;
  return setup || state.board.vertices[vertex].edges.some(e => state.roads[e] === player);
}
export function canRoad(state, player, edge, setup = false) {
  if (!integer(edge) || edge >= state.roads.length || state.roads[edge] !== null) return false;
  const { a, b } = state.board.edges[edge];
  if (setup) return a === state.setupVertex || b === state.setupVertex;
  return [a, b].some(v => state.buildings[v]?.owner === player ||
    (!state.buildings[v] && state.board.vertices[v].edges.some(e => state.roads[e] === player)));
}
function produce(state, number) {
  const demand = Object.fromEntries(GOODS.map(g => [g, new Map()]));
  state.board.tiles.forEach((tile, id) => {
    if (tile.number !== number || state.robber === id) return;
    const good = YIELDS[tile.terrain];
    tile.vertices.forEach(v => {
      const building = state.buildings[v];
      if (building) demand[good].set(building.owner, (demand[good].get(building.owner) || 0) +
        (building.city ? 2 : 1));
    });
  });
  for (const good of GOODS) {
    const claimants = [...demand[good]];
    const total = claimants.reduce((n, [, amount]) => n + amount, 0);
    if (total > state.bank[good] && claimants.length > 1) continue;
    for (const [p, amount] of claimants)
      transfer(state, p, { [good]: Math.min(amount, state.bank[good]) });
  }
}
export function tradeRate(state, player, good) {
  const ports = state.board.vertices.flatMap((v, i) =>
    state.buildings[i]?.owner === player && v.port ? [v.port] : []);
  return ports.includes(good) ? 2 : ports.includes('any') ? 3 : 4;
}
function robberVictims(state, tile) {
  return [...new Set(state.board.tiles[tile].vertices.flatMap(v => {
    const owner = state.buildings[v]?.owner;
    return owner !== undefined && owner !== state.current && SUM(state.players[owner].goods) > 0 ? [owner] : [];
  }))];
}
function steal(state, victim, random) {
  const total = SUM(state.players[victim].goods);
  let index = Math.floor(random() * total);
  for (const good of GOODS) {
    index -= state.players[victim].goods[good];
    if (index < 0) {
      state.players[victim].goods[good]--;
      state.players[state.current].goods[good]++;
      return;
    }
  }
}

// Every request is checked before mutation. The host runs this for room requests.
export function actCatan(state, action, actor = state.current, random = Math.random) {
  if (!state || !action || typeof action !== 'object' ||
      !integer(actor) || actor >= state.players.length || state.winner !== null) return false;
  const p = state.players[actor], phase = state.phase;
  const type = action.type;
  if (type === 'discard') {
    if (phase !== 'discard' || !state.discards[actor] || !validGoods(action.goods) ||
        SUM(action.goods) !== state.discards[actor] || !hasGoods(p, action.goods)) return false;
    pay(state, actor, action.goods);
    state.discards[actor] = 0;
    if (state.discards.every(n => n === 0)) state.phase = 'robber';
    state.message = 'Return half your cargo; the raider moves next.';
    return true;
  }
  if (actor !== state.current) return false;
  if (type === 'setup-settlement') {
    if (phase !== 'setup-settlement' || !canSettle(state, actor, action.vertex, true)) return false;
    state.buildings[action.vertex] = { owner: actor, city: false };
    p.settlements++;
    state.setupVertex = action.vertex;
    state.phase = 'setup-road';
    if (state.setupStep >= state.players.length)
      for (const id of state.board.vertices[action.vertex].tiles) {
        const good = YIELDS[state.board.tiles[id].terrain];
        if (good && state.bank[good]) transfer(state, actor, { [good]: 1 });
      }
    state.message = 'Lay a road beside your new outpost.';
    return true;
  }
  if (type === 'setup-road') {
    if (phase !== 'setup-road' || !canRoad(state, actor, action.edge, true)) return false;
    state.roads[action.edge] = actor;
    p.roads++;
    state.setupVertex = null;
    state.setupStep++;
    const n = state.players.length;
    if (state.setupStep === 2 * n) {
      state.current = 0; state.phase = 'roll'; state.turn = 1;
      state.message = 'First voyage: roll both dice.';
    } else {
      state.current = state.setupStep < n ? state.setupStep : 2 * n - 1 - state.setupStep;
      state.phase = 'setup-settlement';
      state.message = 'Place your outpost.';
    }
    return true;
  }
  if (type === 'robber') {
    if (phase !== 'robber' || !integer(action.tile) || action.tile >= state.board.tiles.length ||
        action.tile === state.robber || !(action.victim === null || integer(action.victim) &&
          robberVictims(state, action.tile).includes(action.victim))) return false;
    const victims = robberVictims(state, action.tile);
    if (victims.length && action.victim === null) return false;
    state.robber = action.tile;
    if (action.victim !== null) steal(state, action.victim, random);
    state.phase = state.robberReturn;
    state.message = action.victim === null ? 'The raider blocks that land.' : 'One hidden cargo was taken.';
    updateAwards(state);
    return true;
  }
  if (type === 'roll') {
    if (phase !== 'roll' || !Array.isArray(action.dice) || action.dice.length !== 2 ||
        !integer(action.dice[0], 1) || !integer(action.dice[1], 1) ||
        action.dice[0] > 6 || action.dice[1] > 6) return false;
    state.rolled = action.dice;
    const total = action.dice[0] + action.dice[1];
    if (total === 7) {
      state.discards = state.players.map(player =>
        SUM(player.goods) > 7 ? Math.floor(SUM(player.goods) / 2) : 0);
      state.robberReturn = 'main';
      state.phase = state.discards.some(Boolean) ? 'discard' : 'robber';
      state.message = 'Seven! Return excess cargo, then move the raider.';
    } else {
      produce(state, total);
      state.phase = 'main';
      state.message = `A ${total} brought fresh cargo. Trade or build.`;
    }
    updateAwards(state);
    return true;
  }
  if (type === 'play-dev') {
    if (!['roll', 'main'].includes(phase) || state.devPlayed ||
        !['knight', 'roads', 'plenty', 'monopoly'].includes(action.card)) return false;
    const index = p.dev.findIndex(c => c.type === action.card && c.bought < state.turn);
    if (index < 0) return false;
    if (action.card === 'plenty') {
      if (!validGoods(action.goods) || SUM(action.goods) !== 2 ||
          !hasGoods({ goods: state.bank }, action.goods)) return false;
    }
    if (action.card === 'monopoly' && !isGood(action.good)) return false;
    p.dev.splice(index, 1);
    state.devPlayed = true;
    state.offer = null;
    if (action.card === 'knight') {
      p.knights++;
      state.robberReturn = phase;
      state.phase = 'robber';
      state.message = 'Move the raider and choose a neighboring rival.';
    } else if (action.card === 'roads') {
      state.freeRoads = Math.min(2, 15 - p.roads, state.roads.filter(r => r === null).length);
      if (state.freeRoads && phase === 'roll') {
        state.roadsReturn = 'roll';
        state.phase = 'free-roads';
      }
      state.message = 'Build up to two free roads.';
    } else if (action.card === 'plenty') {
      transfer(state, actor, action.goods);
      state.message = 'Two supplies arrived from the bank.';
    } else {
      for (let i = 0; i < state.players.length; i++) {
        if (i === actor) continue;
        const quantity = state.players[i].goods[action.good];
        state.players[i].goods[action.good] = 0;
        p.goods[action.good] += quantity;
      }
      state.message = `The market yielded all ${action.good}.`;
    }
    updateAwards(state);
    return true;
  }
  if (phase !== 'main' && phase !== 'free-roads') return false;
  if (type === 'build-road') {
    if (p.roads >= 15 || !canRoad(state, actor, action.edge) ||
        (phase === 'free-roads' && !state.freeRoads) ||
        (!state.freeRoads && !hasGoods(p, COSTS.road))) return false;
    if (state.freeRoads) state.freeRoads--;
    else pay(state, actor, COSTS.road);
    state.roads[action.edge] = actor;
    p.roads++;
    if (!state.freeRoads && phase === 'free-roads') state.phase = state.roadsReturn;
    state.message = 'A new path crosses the island.';
  } else if (type === 'skip-free-roads') {
    if (!state.freeRoads) return false;
    state.freeRoads = 0;
    if (phase === 'free-roads') state.phase = state.roadsReturn;
    state.message = 'You passed on the remaining free roads.';
  } else if (phase === 'free-roads') return false;
  else if (type === 'build-settlement') {
    if (state.freeRoads || p.settlements >= 5 ||
        !canSettle(state, actor, action.vertex) || !hasGoods(p, COSTS.settlement)) return false;
    pay(state, actor, COSTS.settlement);
    state.buildings[action.vertex] = { owner: actor, city: false };
    p.settlements++;
    state.message = 'A new outpost takes root.';
  } else if (type === 'build-city') {
    const existing = state.buildings[action.vertex];
    if (state.freeRoads || !integer(action.vertex) || !existing ||
        existing.owner !== actor || existing.city || p.cities >= 4 ||
        !hasGoods(p, COSTS.city)) return false;
    pay(state, actor, COSTS.city);
    existing.city = true; p.cities++; p.settlements--;
    state.message = 'Your outpost grew into a city.';
  } else if (type === 'buy-dev') {
    if (state.freeRoads || !state.deck.length || !hasGoods(p, COSTS.development)) return false;
    pay(state, actor, COSTS.development);
    p.dev.push({ type: state.deck.pop(), bought: state.turn });
    state.message = 'A discovery joins your private hand.';
  } else if (type === 'bank-trade') {
    if (state.freeRoads || !isGood(action.give) || !isGood(action.receive) ||
        action.give === action.receive || !integer(action.quantity, 1) ||
        action.quantity > 19 || action.quantity * tradeRate(state, actor, action.give) > p.goods[action.give] ||
        action.quantity > state.bank[action.receive]) return false;
    const amount = action.quantity * tradeRate(state, actor, action.give);
    pay(state, actor, { [action.give]: amount });
    transfer(state, actor, { [action.receive]: action.quantity });
    state.message = 'Cargo exchanged at the harbor.';
  } else if (type === 'offer') {
    if (state.freeRoads || !integer(action.to) || action.to >= state.players.length ||
        action.to === actor || !validGoods(action.give) || !validGoods(action.want) ||
        !hasGoods(p, action.give)) return false;
    state.offer = { from: actor, to: action.to, give: { ...action.give }, want: { ...action.want } };
    state.message = `Player ${actor + 1} offered a cargo exchange to Player ${action.to + 1}.`;
  } else if (type === 'cancel-offer') {
    if (!state.offer) return false;
    state.offer = null;
    state.message = 'Trade proposal withdrawn.';
  } else if (type === 'end') {
    if (state.freeRoads) return false;
    state.offer = null;
    state.current = (actor + 1) % state.players.length;
    state.phase = 'roll'; state.rolled = null; state.devPlayed = false; state.turn++;
    state.message = `Player ${state.current + 1}: roll to begin.`;
  } else return false;
  updateAwards(state);
  return true;
}

export function actTradeReply(state, action, actor) {
  const offer = state?.offer;
  if (!offer || state.phase !== 'main' || state.winner !== null ||
      actor !== offer.to || !['accept', 'decline'].includes(action?.type)) return false;
  if (action.type === 'accept') {
    const from = state.players[offer.from], to = state.players[actor];
    if (!hasGoods(from, offer.give) || !hasGoods(to, offer.want)) return false;
    for (const good of GOODS) {
      from.goods[good] += (offer.want[good] || 0) - (offer.give[good] || 0);
      to.goods[good] += (offer.give[good] || 0) - (offer.want[good] || 0);
    }
  }
  state.message = action.type === 'accept' ? 'Cargo changed hands.' : 'Trade proposal declined.';
  state.offer = null;
  return true;
}

export function applyRemoteCatanAction(state, request, revision, from, playerIds,
  random = Math.random) {
  if (request?.type !== 'ct-request' || request.revision !== revision ||
      !Array.isArray(playerIds) || !request.move || typeof request.move !== 'object') return false;
  const actor = playerIds.indexOf(from);
  if (actor < 0) return false;
  const move = request.move.type === 'roll'
    ? { type: 'roll', dice: [1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6)] }
    : request.move;
  return ['accept', 'decline'].includes(move.type) ?
    actTradeReply(state, move, actor) : actCatan(state, move, actor, random);
}

export function validCatanCheckpoint(state) {
  if (!state || !Array.isArray(state.players) ||
      ![3, 4].includes(state.players.length) || state.winner !== null ||
      !['setup-settlement', 'setup-road', 'roll', 'discard', 'robber', 'main', 'free-roads'].includes(state.phase) ||
      !integer(state.current) || state.current >= state.players.length ||
      !integer(state.turn) || !integer(state.setupStep) ||
      state.setupStep > 2 * state.players.length ||
      !integer(state.robber) || state.robber >= 19 ||
      !integer(state.freeRoads) || state.freeRoads > 2 ||
      !Array.isArray(state.deck) || state.deck.length > 25 ||
      state.deck.some(card => !DECK.includes(card)) ||
      !Array.isArray(state.board?.tiles) || state.board.tiles.length !== 19 ||
      !Array.isArray(state.board?.vertices) || state.board.vertices.length !== 54 ||
      !Array.isArray(state.board?.edges) || state.board.edges.length !== 72 ||
      state.board.tiles.some(t => !Array.isArray(t?.vertices) || t.vertices.length !== 6 ||
        t.vertices.some(v => !integer(v) || v >= 54)) ||
      state.board.vertices.some(v => !Array.isArray(v?.edges) ||
        !Array.isArray(v.neighbors) || !Array.isArray(v.tiles) ||
        !Number.isFinite(v.x) || !Number.isFinite(v.y) ||
        v.edges.some(e => !integer(e) || e >= 72) ||
        v.neighbors.some(n => !integer(n) || n >= 54)) ||
      state.board.edges.some(e => !integer(e?.a) || !integer(e?.b) || e.a >= 54 || e.b >= 54) ||
      !Array.isArray(state.buildings) || state.buildings.length !== 54 ||
      state.buildings.some(b => b !== null && (!integer(b?.owner) ||
        b.owner >= state.players.length || typeof b.city !== 'boolean')) ||
      !Array.isArray(state.roads) || state.roads.length !== 72 ||
      state.roads.some(r => r !== null && (!integer(r) || r >= state.players.length)) ||
      !Array.isArray(state.discards) || state.discards.some(n => !integer(n)) ||
      state.phase === 'discard' && state.discards.length !== state.players.length ||
      !(state.setupVertex === null || integer(state.setupVertex) && state.setupVertex < 54) ||
      !(state.offer === null || state.offer && integer(state.offer.from) &&
        integer(state.offer.to) && state.offer.from === state.current &&
        state.offer.to < state.players.length && state.offer.to !== state.current &&
        validGoods(state.offer.give) && validGoods(state.offer.want)) ||
      !['roll', 'main'].includes(state.roadsReturn) ||
      ![null, ...state.players.map((_, i) => i)].includes(state.longest) ||
      ![null, ...state.players.map((_, i) => i)].includes(state.largest) ||
      typeof state.devPlayed !== 'boolean' ||
      typeof state.message !== 'string' || state.message.length > 200 ||
      !GOODS.every(g => integer(state.bank?.[g]) && state.bank[g] <= 19)) return false;
  return state.players.every((p, i) => p && integer(p.roads) && p.roads <= 15 &&
    integer(p.settlements) && p.settlements <= 5 &&
    integer(p.cities) && p.cities <= 4 && integer(p.knights) &&
    p.roads === state.roads.filter(owner => owner === i).length &&
    p.settlements === state.buildings.filter(b => b?.owner === i && !b.city).length &&
    p.cities === state.buildings.filter(b => b?.owner === i && b.city).length &&
    Array.isArray(p.dev) && p.dev.every(c => DECK.includes(c?.type) && integer(c.bought)) &&
    GOODS.every(g => integer(p.goods?.[g]))) &&
    GOODS.every(g => state.bank[g] +
      state.players.reduce((n, p) => n + p.goods[g], 0) === 19);
}

export function catanView(state, player) {
  return {
    board: state.board, buildings: state.buildings, roads: state.roads,
    goods: { ...state.players[player].goods },
    dev: state.players[player].dev.map(c => ({ ...c })),
    counts: state.players.map(p => ({ goods: SUM(p.goods), dev: p.dev.length,
      roads: p.roads, settlements: p.settlements, cities: p.cities, knights: p.knights })),
    bank: { ...state.bank }, deckCount: state.deck.length, robber: state.robber,
    current: state.current, phase: state.phase, setupStep: state.setupStep,
    setupVertex: state.setupVertex, rolled: state.rolled,
    discards: state.discards, robberReturn: state.robberReturn,
    freeRoads: state.freeRoads, devPlayed: state.devPlayed, turn: state.turn,
    longest: state.longest, largest: state.largest, offer: state.offer,
    scores: state.players.map((_, i) => state.players[i].settlements +
      2 * state.players[i].cities + 2 * (state.longest === i) + 2 * (state.largest === i)),
    myScore: points(state, player), winner: state.winner, message: state.message,
  };
}

const NS = 'http://www.w3.org/2000/svg';
const TERRAIN_LABEL = {
  forest: 'Grove', hills: 'Ridge', fields: 'Meadow', pasture: 'Heath',
  mountains: 'Peak', desert: 'Wastes',
};
const TERRAIN_ICON = {
  forest: '♣', hills: '▲', fields: '✿', pasture: '✧', mountains: '◆', desert: '☼',
};
const GOOD_LABEL = { timber: 'Timber', clay: 'Clay', grain: 'Grain', wool: 'Wool', ore: 'Ore' };
const CARD_LABEL = { knight: 'Ranger', victory: 'Legacy', roads: 'Trailblazer',
  plenty: 'Windfall', monopoly: 'Market Sweep' };
const pieceLabel = (v, state, room) => state.buildings[v] ?
  `${playerName(state.buildings[v].owner, room)} ${state.buildings[v].city ? 'city' : 'outpost'}` : `Junction ${v + 1}`;
const svg = (tag, attrs = {}, text) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
};
const button = (label, onClick, disabled = false, className = '') => {
  const el = document.createElement('button');
  el.type = 'button'; el.className = `ct-btn ${className}`;
  el.textContent = label; el.disabled = disabled;
  el.addEventListener('click', onClick);
  return el;
};
const select = (values, label, selected = values[0][0]) => {
  const wrapper = document.createElement('label');
  wrapper.className = 'ct-field';
  wrapper.append(document.createTextNode(label));
  const input = document.createElement('select');
  for (const [value, text] of values) {
    const option = document.createElement('option');
    option.value = String(value); option.textContent = text;
    input.append(option);
  }
  input.value = String(selected);
  wrapper.append(input);
  return [wrapper, input];
};
const goodSelect = (label, chosen = GOODS[0]) =>
  select(GOODS.map(g => [g, GOOD_LABEL[g]]), label, chosen);
const numberSelect = (label, initial = 1, maximum = 19) =>
  select(Array.from({ length: maximum }, (_, i) => [i + 1, String(i + 1)]), label, initial);
const description = goods => GOODS.filter(g => goods[g]).map(g => `${goods[g]} ${GOOD_LABEL[g]}`).join(' · ');

export default {
  async render(el, game, { navigate, multiplayer, session } = {}) {
    const shell = createShell(el, game, {
      title: 'Island Charter', meta: 'Settle · barter · chart new paths', resetLabel: 'New island',
    });
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('ct-vibe');
    const room = remoteMatch(multiplayer, game.id);
    const showTurn = createTurnIndicator(shell.root, room);
    if (room && room.activeGame.playerIds.length < 3) {
      const note = document.createElement('p');
      note.className = 'ct-warning';
      note.textContent = 'This island requires 3 or 4 players. Return to the room and add another navigator.';
      shell.stage.append(note);
      shell.getResetButton().disabled = true;
      return { dispose: () => shell.root.remove() };
    }
    const restored = !room && validCatanCheckpoint(session?.state) ? session.state : null;
    const setting = room ? { count: room.activeGame.playerIds.length } :
      restored ? { count: restored.players.length } :
      await renderSetup(shell.stage, {
        title: '⟡ Island Charter', subtitle: 'A shared table for three or four navigators. No automated players.',
        themeClass: 'ct-setup', startLabel: 'Chart the island',
        fields: [{ key: 'count', label: 'Navigators', default: '3',
          options: [3, 4].map(n => ({ value: String(n), label: `${n} players` })) }],
      });
    const count = Number(setting.count), mySeat = room ? seat(room) - 1 : null;
    let state = room?.role === 'guest' ? null : restored || newCatan(count);
    let view = state ? catanView(state, mySeat ?? 0) : null;
    let revision = 0, lastRevision = -1, round = 0, disposed = false;
    let tool = 'road', chosenTile = null, panel = 'build';
    let covered = !room, localViewer = state?.phase === 'discard' ?
      state.discards.findIndex(Boolean) : state?.offer?.to ?? state?.current ?? 0;
    const table = document.createElement('div');
    table.className = 'ct-table';
    shell.stage.append(table);
    shell.root.querySelector('.game-meta').textContent =
      room ? `Private room · ${count} players · seat ${mySeat + 1}` :
        `${count} players · local pass & play`;
    function feedback(kind = 'tap') {
      const audio = window.arcadeAudio;
      if (audio) void audio.prepare().then(() => audio[kind]?.()).catch(() => {});
      window.haptics?.[kind === 'chime' ? 'success' : kind === 'buzz' ? 'failure' : 'select']();
    }
    function publish() {
      if (!room || room.role !== 'host') return;
      revision++;
      view = catanView(state, mySeat);
      for (let i = 1; i < count; i++)
        room.sendPrivateAction(room.activeGame.playerIds[i],
          { type: 'ct-state', revision, view: catanView(state, i) });
    }
    function localNextViewer() {
      if (state.phase === 'discard') {
        localViewer = state.discards.findIndex(Boolean);
      } else if (state.offer) localViewer = state.offer.to;
      else localViewer = state.current;
      covered = state.winner === null;
    }
    function dispatch(move) {
      if (room) {
        room.sendAction({ type: 'ct-request', revision: room.role === 'host' ? revision : lastRevision,
          move: move.type === 'roll' ? { type: 'roll' } : move });
        return;
      }
      const previous = state.winner;
      const action = move.type === 'roll'
        ? { type: 'roll', dice: [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)] }
        : move;
      const actor = state.phase === 'discard' ? localViewer :
        ['accept', 'decline'].includes(action.type) ? state.offer?.to : state.current;
      if ((['accept', 'decline'].includes(action.type) ?
        actTradeReply(state, action, actor) : actCatan(state, action, actor))) {
        feedback(state.winner !== null ? 'chime' : 'tap');
        if (previous === null && state.winner !== null)
          celebrate(shell.root, `${playerName(state.winner)} founded a thriving island!`);
        if (state.winner !== null) session?.finish();
        else session?.save(state);
        if (action.type === 'end' || action.type === 'setup-road' ||
            action.type === 'offer' || action.type === 'discard' ||
            action.type === 'roll' && state.phase === 'discard' ||
            ['accept', 'decline'].includes(action.type)) localNextViewer();
        if (state.phase !== 'robber') chosenTile = null;
        render();
      } else feedback('buzz');
    }
    const offRoom = room?.on(event => {
      if (disposed || event.type !== 'action' || room.activeGame?.id !== game.id) return;
      if (room.role === 'host') {
        const from = room.activeGame.playerIds.indexOf(event.from);
        if (event.action?.type === 'ct-sync') {
          if (from > 0) room.sendPrivateAction(event.from,
            { type: 'ct-state', revision, view: catanView(state, from) });
        } else if (event.action?.type === 'ct-request' && from >= 0) {
          const request = event.action;
          const previous = state.winner;
          if (applyRemoteCatanAction(state, request, revision, event.from,
            room.activeGame.playerIds)) {
            feedback(state.winner !== null ? 'chime' : 'tap');
            if (previous === null && state.winner !== null) {
              room.recordResult(game.id, state.winner, round);
              if (state.winner === mySeat)
                celebrate(shell.root, `${playerName(state.winner, room)} founded a thriving island!`);
            }
            publish(); chosenTile = null; render();
          } else if (from > 0) room.sendPrivateAction(event.from,
            { type: 'ct-state', revision, view: catanView(state, from) });
        } else if (event.action?.type === 'ct-reset' && from === 0) {
          state = newCatan(count); round++;
          shell.root.querySelector('.arcade-victory')?.remove();
          publish(); render();
        }
      } else if (event.from === room.activeGame.playerIds[0] &&
          event.action?.type === 'ct-state' &&
          Number.isSafeInteger(event.action.revision) &&
          event.action.revision >= lastRevision) {
        const incoming = event.action.view;
        if (!incoming || incoming.board?.tiles?.length !== 19 ||
            incoming.board.vertices?.length !== 54 || incoming.board.edges?.length !== 72 ||
            incoming.counts?.length !== count || incoming.buildings?.length !== 54 ||
            incoming.roads?.length !== 72 || !incoming.goods || !Array.isArray(incoming.dev) ||
            !integer(incoming.current) || incoming.current >= count ||
            !['setup-settlement', 'setup-road', 'roll', 'discard', 'robber', 'free-roads', 'main'].includes(incoming.phase) ||
            !integer(incoming.turn) || incoming.turn > 100000 ||
            ![null, ...Array.from({ length: count }, (_, i) => i)].includes(incoming.winner)) return;
        lastRevision = event.action.revision;
        const previous = view?.winner;
        view = incoming;
        if (previous === null && view.winner === mySeat)
          celebrate(shell.root, `${playerName(mySeat, room)} founded a thriving island!`);
        chosenTile = null; render();
      }
    });

    function boardNode(data, canAct) {
      const chart = svg('svg', { viewBox: '0 0 760 700', class: 'ct-chart',
        role: 'group', 'aria-label': 'Island chart. Select marked land, paths or junctions to act.' });
      const board = data.board;
      const legalEdge = id => canAct && (data.phase === 'setup-road' ?
        canRoad(data, data.current, id, true) :
        ['main', 'free-roads'].includes(data.phase) &&
        (data.freeRoads || tool === 'road') &&
        data.counts[data.current].roads < 15 &&
        canRoad(data, data.current, id) &&
        (data.freeRoads || hasGoods({ goods: data.goods }, COSTS.road)));
      const legalVertex = id => canAct && (
        data.phase === 'setup-settlement' && canSettle(data, data.current, id, true) ||
        data.phase === 'main' && !data.freeRoads && (
          tool === 'settlement' && data.counts[data.current].settlements < 5 &&
          canSettle(data, data.current, id) &&
          hasGoods({ goods: data.goods }, COSTS.settlement) ||
          tool === 'city' && data.buildings[id]?.owner === data.current &&
          !data.buildings[id].city && data.counts[data.current].cities < 4 &&
          hasGoods({ goods: data.goods }, COSTS.city)));
      board.tiles.forEach((tile, id) => {
        const center = {
          x: board.vertices[tile.vertices[0]].x + board.vertices[tile.vertices[3]].x,
          y: board.vertices[tile.vertices[0]].y + board.vertices[tile.vertices[3]].y,
        };
        center.x /= 2; center.y /= 2;
        const group = svg('g', { class: `ct-hex ct-hex--${tile.terrain} ${id === data.robber ? 'ct-hex--blocked' : ''}` });
        const poly = svg('polygon', {
          points: tile.vertices.map(v => `${board.vertices[v].x.toFixed(2)},${board.vertices[v].y.toFixed(2)}`).join(' '),
          'data-tile': id, role: 'button', tabindex: canAct && data.phase === 'robber' ? '0' : '-1',
          'aria-label': `${TERRAIN_LABEL[tile.terrain]}${tile.number ? `, number ${tile.number}` : ''}${id === data.robber ? ', blocked' : ''}`,
        });
        group.append(poly, svg('text', { x: center.x, y: center.y - 14, class: 'ct-terrain-symbol', 'pointer-events': 'none' },
          TERRAIN_ICON[tile.terrain]));
        group.append(svg('text', { x: center.x, y: center.y + 15, class: 'ct-terrain-name', 'pointer-events': 'none' },
          TERRAIN_LABEL[tile.terrain]));
        if (tile.number) group.append(svg('text', { x: center.x, y: center.y + 37,
          class: `ct-token ${[6, 8].includes(tile.number) ? 'ct-token--hot' : ''}`, 'pointer-events': 'none' }, tile.number));
        if (id === data.robber)
          group.append(svg('text', { x: center.x + 33, y: center.y - 29,
            class: 'ct-raider', 'pointer-events': 'none' }, '✦'));
        chart.append(group);
      });
      board.edges.forEach((edge, id) => {
        const a = board.vertices[edge.a], b = board.vertices[edge.b];
        const klass = data.roads[id] === null ? 'ct-path--free' : 'ct-path--owned';
        const group = svg('g', { class: 'ct-edge-group' });
        const path = svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y,
          class: `ct-path ${klass}${legalEdge(id) ? ' ct-clickable' : ''}`, 'pointer-events': 'none' });
        const hit = svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y,
          class: 'ct-edge-hit', 'pointer-events': legalEdge(id) ? 'stroke' : 'none',
          'data-edge': id, role: 'button', tabindex: legalEdge(id) ? '0' : '-1',
          'aria-label': data.roads[id] === null ? `Path ${id + 1}, vacant` :
            `Path ${id + 1}, ${playerName(data.roads[id], room)} road` });
        if (data.roads[id] !== null) path.style.setProperty('--ct-owner', COLORS[data.roads[id]]);
        group.append(path, hit);
        chart.append(group);
        if (edge.port) {
          const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
          const dx = x - 380, dy = y - 350, length = Math.hypot(dx, dy);
          const mark = svg('text', { x: x + dx / length * 28, y: y + dy / length * 28 + 4,
            class: 'ct-harbor', 'pointer-events': 'none' },
          edge.port === 'any' ? '3:1' : `${GOOD_LABEL[edge.port].slice(0, 1)} 2:1`);
          chart.append(mark);
        }
      });
      board.vertices.forEach((vertex, id) => {
        const owned = data.buildings[id];
        const group = svg('g', { class: 'ct-vertex-group' });
        const mark = svg('circle', { cx: vertex.x, cy: vertex.y,
          r: owned ? owned.city ? 11 : 9 : 5,
          class: `ct-junction ${owned ? 'ct-junction--owned' : 'ct-junction--empty'}${legalVertex(id) ? ' ct-clickable' : ''}`,
          'pointer-events': 'none' });
        const hit = svg('circle', { cx: vertex.x, cy: vertex.y, r: VERTEX_TOUCH_RADIUS,
          class: 'ct-vertex-hit', 'pointer-events': legalVertex(id) ? 'all' : 'none',
          'data-vertex': id, role: 'button', tabindex: legalVertex(id) ? '0' : '-1',
          'aria-label': `${pieceLabel(id, data, room)}${vertex.port ? `, harbor ${vertex.port}` : ''}` });
        if (owned) mark.style.setProperty('--ct-owner', COLORS[owned.owner]);
        group.append(mark, hit);
        chart.append(group);
      });
      const onSelect = target => {
        if (!canAct) return;
        const tile = target.closest('[data-tile]');
        const edge = target.closest('[data-edge]');
        const vertex = target.closest('[data-vertex]');
        if (tile && data.phase === 'robber') {
          const id = Number(tile.getAttribute('data-tile'));
          if (id !== data.robber) { chosenTile = id; render(); }
        } else if (edge && legalEdge(Number(edge.getAttribute('data-edge')))) {
          dispatch({ type: data.phase === 'setup-road' ? 'setup-road' : 'build-road',
            edge: Number(edge.getAttribute('data-edge')) });
        } else if (vertex && legalVertex(Number(vertex.getAttribute('data-vertex')))) {
          const id = Number(vertex.getAttribute('data-vertex'));
          if (data.phase === 'setup-settlement') dispatch({ type: 'setup-settlement', vertex: id });
          else if (data.phase === 'main' && !data.freeRoads && tool === 'settlement')
            dispatch({ type: 'build-settlement', vertex: id });
          else if (data.phase === 'main' && !data.freeRoads && tool === 'city')
            dispatch({ type: 'build-city', vertex: id });
        }
      };
      chart.addEventListener('click', event => onSelect(event.target));
      chart.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          if (event.target.matches('[data-tile],[data-edge],[data-vertex]')) {
            event.preventDefault(); onSelect(event.target);
          }
        }
      });
      return chart;
    }

    function render() {
      if (disposed) return;
      const data = room ? view : catanView(state, localViewer);
      const chartScroll = table.querySelector('.ct-chart-wrap')?.scrollLeft ?? 0;
      table.replaceChildren();
      if (!data) {
        showTurn(null);
        const waiting = document.createElement('p');
        waiting.className = 'ct-waiting';
        waiting.textContent = 'Waiting for the host to chart the island…';
        table.append(waiting); return;
      }
      if (!room && covered) {
        showTurn(null);
        const shield = document.createElement('section');
        shield.className = 'ct-shield';
        const header = document.createElement('h3');
        header.textContent = `Pass the table to ${playerName(localViewer)}`;
        const copy = document.createElement('p');
        copy.textContent = 'Hands stay hidden until the next navigator is ready.';
        shield.append(header, copy, button('Reveal my table', () => {
          covered = false; feedback(); render();
        }, false, 'ct-primary'));
        table.append(shield); return;
      }
      const isMe = room ? mySeat : localViewer;
      const turnFocus = data.phase === 'discard'
        ? data.discards[isMe] ? isMe : data.discards.findIndex(Boolean)
        : data.offer?.to ?? data.current;
      showTurn(turnFocus, data.winner === null);
      const canAct = data.winner === null && data.current === isMe &&
        data.phase !== 'discard' && (!data.offer || data.offer.from === isMe);
      const title = document.createElement('div');
      title.className = 'ct-banner';
      const titleText = document.createElement('div');
      const eyebrow = document.createElement('span');
      eyebrow.className = 'ct-eyebrow';
      eyebrow.textContent = `✦ ${room ? 'PRIVATE ROOM' : 'SHARED TABLE'} · VOYAGE ${data.turn || 'PRELUDE'}`;
      const heading = document.createElement('h3');
      heading.textContent = data.winner === null ?
        `${playerName(data.current, room)} · ${({
          'setup-settlement': 'choose an outpost', 'setup-road': 'lay an opening road',
          roll: 'roll the dice', discard: 'return cargo', robber: 'move the raider',
          main: 'trade & build', 'free-roads': 'chart free paths',
        })[data.phase]}` : `${playerName(data.winner, room)} chartered the island!`;
      titleText.append(eyebrow, heading);
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.textContent = data.message;
      title.append(titleText, status);
      table.append(title);
      const layout = document.createElement('div');
      layout.className = 'ct-layout';
      const chartArea = document.createElement('div');
      chartArea.className = 'ct-chart-area';
      const scrollHint = document.createElement('p');
      scrollHint.className = 'ct-scroll-hint';
      scrollHint.textContent = 'Swipe the island sideways to see every shore →';
      const chartWrap = document.createElement('div');
      chartWrap.className = 'ct-chart-wrap';
      chartWrap.append(boardNode(data, canAct));
      chartArea.append(scrollHint, chartWrap);
      const aside = document.createElement('aside');
      aside.className = 'ct-sidebar';
      const roster = document.createElement('div');
      roster.className = 'ct-roster';
      data.counts.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = `ct-player${i === data.current ? ' ct-player--active' : ''}`;
        row.style.setProperty('--ct-owner', COLORS[i]);
        const name = document.createElement('strong');
        name.textContent = playerName(i, room);
        const details = document.createElement('span');
        details.textContent = `${p.goods} cargo · ${p.dev} discoveries · ${p.knights} rangers`;
        const score = document.createElement('b');
        score.textContent = i === isMe ? `${data.myScore}★` : `${data.scores[i]}+★`;
        row.append(name, details, score);
        roster.append(row);
      });
      aside.append(roster);
      const awards = document.createElement('p');
      awards.className = 'ct-awards';
      awards.textContent = `Longest trail (5+): ${data.longest === null ? 'unclaimed' : playerName(data.longest, room)}  ·  Largest patrol (3+): ${data.largest === null ? 'unclaimed' : playerName(data.largest, room)}`;
      aside.append(awards);
      const hand = document.createElement('section');
      hand.className = 'ct-hand';
      const handHeading = document.createElement('h4');
      handHeading.textContent = `${playerName(isMe, room)} · private cargo`;
      hand.append(handHeading);
      const goods = document.createElement('div');
      goods.className = 'ct-cargo';
      GOODS.forEach(g => {
        const token = document.createElement('div');
        token.className = `ct-good ct-good--${g}`;
        token.innerHTML = `<span class="ct-good-icon" aria-hidden="true">${({ timber: '♣', clay: '⬟', grain: '✿', wool: '✧', ore: '◆' })[g]}</span>`;
        const name = document.createElement('span');
        name.textContent = GOOD_LABEL[g];
        const amount = document.createElement('b');
        amount.textContent = data.goods[g];
        token.append(name, amount); goods.append(token);
      });
      hand.append(goods);
      const cards = document.createElement('div');
      cards.className = 'ct-cards';
      data.dev.forEach(card => {
        const tag = document.createElement('span');
        tag.className = 'ct-card';
        tag.textContent = CARD_LABEL[card.type];
        cards.append(tag);
      });
      if (!cards.childNodes.length) cards.textContent = 'No discoveries yet.';
      hand.append(cards);
      aside.append(hand);
      const actions = document.createElement('div');
      actions.className = 'ct-actions';
      aside.append(actions);
      layout.append(chartArea, aside); table.append(layout);
      chartWrap.scrollLeft = chartScroll;
      if (data.winner !== null) return;
      if (data.phase === 'discard') {
        const quota = data.discards[isMe] || 0;
        const info = document.createElement('p');
        info.textContent = quota ? `Return exactly ${quota} supplies to the bank.` :
          'Waiting for other navigators to return cargo.';
        actions.append(info);
        if (quota) {
          const fields = new Map();
          const grid = document.createElement('div');
          grid.className = 'ct-form-grid';
          GOODS.forEach(g => {
            const [label, input] = numberSelect(GOOD_LABEL[g], 1, Math.min(data.goods[g], quota) + 1);
            input.replaceChildren(...Array.from({ length: Math.min(data.goods[g], quota) + 1 },
              (_, n) => {
                const opt = document.createElement('option');
                opt.value = n; opt.textContent = n; return opt;
              }));
            fields.set(g, input); grid.append(label);
          });
          const warning = document.createElement('p');
          warning.className = 'ct-hint';
          warning.textContent = 'Choose quantities totaling the requested amount.';
          actions.append(grid, button('Return cargo', () => {
            const given = Object.fromEntries(GOODS.map(g => [g, Number(fields.get(g).value)]));
            if (SUM(given) === quota) dispatch({ type: 'discard', goods: given });
            else { warning.textContent = `Choose exactly ${quota} supplies.`; feedback('buzz'); }
          }, false, 'ct-primary'), warning);
        }
        return;
      }
      if (data.offer) {
        const offer = data.offer;
        const notice = document.createElement('div');
        notice.className = 'ct-trade-notice';
        notice.textContent = `${playerName(offer.from, room)} offers ${description(offer.give)} for ${description(offer.want)} to ${playerName(offer.to, room)}.`;
        actions.append(notice);
        if (isMe === offer.to) {
          actions.append(button('Accept exchange', () => dispatch({ type: 'accept' }), false, 'ct-primary'),
            button('Decline', () => dispatch({ type: 'decline' })));
          return;
        }
        if (canAct) actions.append(button('Withdraw offer', () => dispatch({ type: 'cancel-offer' })));
      }
      if (!canAct) {
        const hint = document.createElement('p');
        hint.className = 'ct-hint';
        hint.textContent = `Waiting for ${playerName(data.current, room)}.`;
        actions.append(hint); return;
      }
      if (data.phase === 'setup-settlement' || data.phase === 'setup-road') {
        const note = document.createElement('p');
        note.className = 'ct-hint';
        note.textContent = data.phase === 'setup-settlement'
          ? 'Tap any vacant junction at least two edges from another outpost.'
          : 'Tap a vacant path touching your new outpost. The second outpost collects nearby supplies.';
        actions.append(note); return;
      }
      if (data.phase === 'roll') {
        actions.append(button('⚄  Roll two dice', () => dispatch({ type: 'roll' }), false, 'ct-primary'));
      }
      if (data.phase === 'robber') {
        const note = document.createElement('p');
        note.className = 'ct-hint';
        note.textContent = 'Select another land tile, then choose a neighbor to take one hidden supply.';
        actions.append(note);
        if (chosenTile !== null) {
          const victims = [...new Set(data.board.tiles[chosenTile].vertices.flatMap(v => {
            const owner = data.buildings[v]?.owner;
            return owner !== undefined && owner !== data.current && data.counts[owner].goods > 0 ?
              [owner] : [];
          }))];
          actions.append(document.createTextNode(`Raider destination: ${TERRAIN_LABEL[data.board.tiles[chosenTile].terrain]}`));
          if (victims.length) victims.forEach(victim => actions.append(
            button(`Take from ${playerName(victim, room)}`, () =>
              dispatch({ type: 'robber', tile: chosenTile, victim }), false, 'ct-primary')));
          else actions.append(button('Block this land', () =>
            dispatch({ type: 'robber', tile: chosenTile, victim: null }), false, 'ct-primary'));
        }
      }
      if (data.phase === 'free-roads') {
        const note = document.createElement('p');
        note.className = 'ct-hint';
        note.textContent = `${data.freeRoads} free path${data.freeRoads > 1 ? 's' : ''} remaining. Tap a connected path, or pass.`;
        actions.append(note, button('Pass free paths', () => dispatch({ type: 'skip-free-roads' })));
        return;
      }
      if (data.phase !== 'main') {
        if (data.phase === 'roll' && !data.devPlayed)
          renderDevActions(actions, data);
        return;
      }
      if (data.rolled) {
        const dice = document.createElement('p');
        dice.className = 'ct-dice';
        dice.textContent = `DICE  ${data.rolled[0]} + ${data.rolled[1]} = ${data.rolled[0] + data.rolled[1]}`;
        actions.append(dice);
      }
      const tabs = document.createElement('div');
      tabs.className = 'ct-tabs';
      for (const [id, label] of [['build', 'Build'], ['trade', 'Trade'], ['discover', 'Discover']])
        tabs.append(button(label, () => { panel = id; render(); }, false,
          panel === id ? 'ct-tab--active' : ''));
      actions.append(tabs);
      if (data.freeRoads) {
        const free = document.createElement('p');
        free.className = 'ct-hint';
        free.textContent = `${data.freeRoads} free path${data.freeRoads > 1 ? 's' : ''} left. Choose a route or pass.`;
        actions.append(free, button('Pass free paths', () => dispatch({ type: 'skip-free-roads' })));
      } else if (panel === 'build') {
        const tools = document.createElement('div');
        tools.className = 'ct-tools';
        [['road', 'Path · timber + clay'], ['settlement', 'Outpost · 4 supplies'],
          ['city', 'City · 2 grain + 3 ore']].forEach(([id, label]) =>
          tools.append(button(label, () => { tool = id; render(); },
            false, tool === id ? 'ct-tool--active' : '')));
        actions.append(tools);
        const hint = document.createElement('p');
        hint.className = 'ct-hint';
        hint.textContent = tool === 'road' ? 'Tap an unoccupied path connected to your network.' :
          tool === 'settlement' ? 'Tap an open junction on your network, away from other buildings.' :
            'Tap one of your outposts to upgrade it.';
        actions.append(hint);
        actions.append(button(`Buy discovery · grain + wool + ore (${data.deckCount} left)`,
          () => dispatch({ type: 'buy-dev' }), !data.deckCount ||
            !GOODS.every(g => data.goods[g] >= (COSTS.development[g] || 0))));
      } else if (panel === 'trade') {
        const bankTitle = document.createElement('h4');
        bankTitle.textContent = 'Harbor exchange';
        const [gLabel, gInput] = goodSelect('Give');
        const [rLabel, rInput] = goodSelect('Receive', 'clay');
        const [qLabel, qInput] = numberSelect('Bundles', 1, 5);
        const rate = document.createElement('p');
        rate.className = 'ct-hint';
        const refreshRate = () => {
          const port = data.board.vertices.flatMap((v, i) =>
            data.buildings[i]?.owner === isMe && v.port ? [v.port] : []);
          const ratio = port.includes(gInput.value) ? 2 : port.includes('any') ? 3 : 4;
          rate.textContent = `${ratio} ${GOOD_LABEL[gInput.value]} → 1 ${GOOD_LABEL[rInput.value]} per bundle · bank has ${data.bank[rInput.value]}`;
        };
        gInput.addEventListener('change', refreshRate);
        rInput.addEventListener('change', refreshRate);
        refreshRate();
        actions.append(bankTitle, gLabel, rLabel, qLabel, rate,
          button('Exchange with bank', () => dispatch({ type: 'bank-trade', give: gInput.value,
            receive: rInput.value, quantity: Number(qInput.value) })));
        const peerTitle = document.createElement('h4');
        peerTitle.textContent = 'Offer to a navigator';
        const [peerLabel, peerInput] = select(
          data.counts.flatMap((_, i) => i === isMe ? [] : [[i, playerName(i, room)]]), 'To');
        const [giveLabel, giveInput] = goodSelect('Offer');
        const [giveQtyLabel, giveQtyInput] = numberSelect('Quantity', 1, 10);
        const [wantLabel, wantInput] = goodSelect('Request');
        const [wantQtyLabel, wantQtyInput] = numberSelect('Quantity', 1, 10);
        actions.append(peerTitle, peerLabel, giveLabel, giveQtyLabel, wantLabel, wantQtyLabel,
          button('Propose exchange', () => dispatch({ type: 'offer', to: Number(peerInput.value),
            give: { [giveInput.value]: Number(giveQtyInput.value) },
            want: { [wantInput.value]: Number(wantQtyInput.value) } })));
      } else {
        renderDevActions(actions, data);
      }
      actions.append(button('Finish voyage →', () => dispatch({ type: 'end' }),
        !!data.freeRoads, 'ct-primary'));
    }
    function renderDevActions(actions, data) {
      const playable = data.dev.filter(card => card.type !== 'victory' &&
        card.bought < data.turn);
      const heading = document.createElement('h4');
      heading.textContent = 'Discoveries';
      actions.append(heading);
      if (!playable.length || data.devPlayed) {
        const note = document.createElement('p');
        note.className = 'ct-hint';
        note.textContent = data.devPlayed ? 'One discovery already played this voyage.' :
          'New discoveries become playable next voyage. Legacy cards score secretly.';
        actions.append(note); return;
      }
      for (const type of [...new Set(playable.map(card => card.type))]) {
        if (type === 'plenty') {
          const [aLabel, aInput] = goodSelect('First supply');
          const [bLabel, bInput] = goodSelect('Second supply');
          actions.append(aLabel, bLabel, button('Play Windfall', () => dispatch({
            type: 'play-dev', card: 'plenty', goods: {
              [aInput.value]: (aInput.value === bInput.value ? 2 : 1),
              ...(aInput.value !== bInput.value ? { [bInput.value]: 1 } : {}),
            },
          })));
        } else if (type === 'monopoly') {
          const [label, input] = goodSelect('Collect all');
          actions.append(label, button('Play Market Sweep', () =>
            dispatch({ type: 'play-dev', card: 'monopoly', good: input.value })));
        } else {
          actions.append(button(`Play ${CARD_LABEL[type]}`, () =>
            dispatch({ type: 'play-dev', card: type }), false, type === 'knight' ? 'ct-primary' : ''));
        }
      }
    }
    shell.getResetButton().addEventListener('click', () => {
      if (room) {
        if (room.role === 'host') room.sendAction({ type: 'ct-reset' });
      } else {
        state = newCatan(count); covered = true; localViewer = 0;
        chosenTile = null; panel = 'build';
        session?.save(state);
        shell.root.querySelector('.arcade-victory')?.remove();
        render();
      }
    });
    if (room?.role !== 'host' && room) shell.getResetButton().disabled = true;
    if (room) {
      if (room.role === 'host') publish();
      else room.sendAction({ type: 'ct-sync' });
    }
    render();
    return { dispose: () => { disposed = true; offRoom?.(); shell.root.remove(); } };
  },
};
