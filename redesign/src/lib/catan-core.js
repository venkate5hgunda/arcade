// Pure Island Charter rules, preserved from the previous application.
const rollDiceValues = (count, random = Math.random) =>
  Array.from({ length: count }, () => 1 + Math.floor(random() * 6));

export const GOODS = ['timber', 'clay', 'grain', 'wool', 'ore'];
export const VERTEX_TOUCH_RADIUS = 22;
export const COSTS = {
  road: { timber: 1, clay: 1 },
  settlement: { timber: 1, clay: 1, grain: 1, wool: 1 },
  city: { grain: 2, ore: 3 },
  development: { grain: 1, wool: 1, ore: 1 },
};
export const COLORS = ['#dc2846', '#2168e2', '#c38c04', '#7335b4'];
const TERRAIN = [
  'forest',
  'forest',
  'forest',
  'forest',
  'hills',
  'hills',
  'hills',
  'fields',
  'fields',
  'fields',
  'fields',
  'pasture',
  'pasture',
  'pasture',
  'pasture',
  'mountains',
  'mountains',
  'mountains',
  'desert',
];
const YIELDS = {
  forest: 'timber',
  hills: 'clay',
  fields: 'grain',
  pasture: 'wool',
  mountains: 'ore',
};
const NUMBERS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
const HARBORS = [
  'any',
  'clay',
  'any',
  'timber',
  'any',
  'wool',
  'any',
  'grain',
  'ore',
];
const PORT_MODES = ['fixed', 'shuffled'];
export const DEFAULT_BOARD_OPTIONS = Object.freeze({
  hotTouch: false,
  coldTouch: false,
  sameNumberTouch: false,
  sameResourceTouch: false,
  imageStyle: 'illustrated',
});
const LEGACY_BOARD_OPTIONS = Object.freeze({
  ...DEFAULT_BOARD_OPTIONS,
  coldTouch: true,
  sameNumberTouch: true,
  sameResourceTouch: true,
});
const OPTION_KEYS = [
  'hotTouch',
  'coldTouch',
  'sameNumberTouch',
  'sameResourceTouch',
];
const validBoardOptions = (options) =>
  options &&
  typeof options === 'object' &&
  OPTION_KEYS.every((key) => typeof options[key] === 'boolean') &&
  ['illustrated', 'colorblock'].includes(options.imageStyle);
const DECK = [
  ...Array(14).fill('knight'),
  ...Array(5).fill('victory'),
  ...Array(2).fill('roads'),
  ...Array(2).fill('plenty'),
  ...Array(2).fill('monopoly'),
];
const SUM = (o) => GOODS.reduce((n, good) => n + (o?.[good] || 0), 0);
const emptyGoods = () => Object.fromEntries(GOODS.map((g) => [g, 0]));
const isGood = (g) => GOODS.includes(g);
const integer = (n, low = 0) => Number.isSafeInteger(n) && n >= low;
const validGoods = (o) =>
  o &&
  typeof o === 'object' &&
  Object.keys(o).every((g) => isGood(g) && integer(o[g])) &&
  SUM(o) > 0;
const shuffled = (items, random) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

function arrange(items, locations, adjacent, canTouch, random) {
  const remaining = new Map();
  for (const item of items) remaining.set(item, (remaining.get(item) || 0) + 1);
  const choices = shuffled([...remaining.keys()], random);
  const order = shuffled(locations, random).sort(
    (a, b) => adjacent[b].length - adjacent[a].length,
  );
  const placed = Array(adjacent.length).fill(undefined);
  function assign(index) {
    if (index === order.length) return true;
    const tile = order[index];
    for (const item of choices) {
      if (
        !remaining.get(item) ||
        adjacent[tile].some(
          (neighbor) =>
            placed[neighbor] !== undefined && !canTouch(item, placed[neighbor]),
        )
      )
        continue;
      placed[tile] = item;
      remaining.set(item, remaining.get(item) - 1);
      if (assign(index + 1)) return true;
      remaining.set(item, remaining.get(item) + 1);
      placed[tile] = undefined;
    }
    return false;
  }
  if (!assign(0))
    throw new Error('No island layout satisfies the selected adjacency rules.');
  return placed;
}

export function createIsland(
  random = Math.random,
  portMode = 'fixed',
  boardOptions = DEFAULT_BOARD_OPTIONS,
) {
  if (!PORT_MODES.includes(portMode))
    throw new RangeError('Unknown harbor layout.');
  if (!validBoardOptions(boardOptions))
    throw new RangeError('Invalid island board options.');
  const coords = [];
  for (let row = -2; row <= 2; row++)
    for (let q = -2; q <= 2; q++)
      if (Math.abs(q + row) <= 2) coords.push([q, row]);
  const adjacent = coords.map(([q, row], i) =>
    coords.flatMap(([x, y], j) =>
      j !== i &&
      Math.max(
        Math.abs(q - x),
        Math.abs(row - y),
        Math.abs(q + row - x - y),
      ) === 1
        ? [j]
        : [],
    ),
  );
  const locations = coords.map((_, i) => i);
  const terrains = boardOptions.sameResourceTouch
    ? shuffled(TERRAIN, random)
    : arrange(
        TERRAIN,
        locations,
        adjacent,
        (a, b) => a !== b || a === 'desert',
        random,
      );
  const numbers = arrange(
    NUMBERS,
    locations.filter((i) => terrains[i] !== 'desert'),
    adjacent,
    (a, b) =>
      (boardOptions.sameNumberTouch || a !== b) &&
      (boardOptions.hotTouch || ![6, 8].includes(a) || ![6, 8].includes(b)) &&
      (boardOptions.coldTouch || ![2, 12].includes(a) || ![2, 12].includes(b)),
    random,
  );
  const tiles = coords.map(([q, row], i) => ({
    q,
    row,
    terrain: terrains[i],
    number: terrains[i] === 'desert' ? null : numbers[i],
    vertices: [],
  }));
  const vertices = [],
    edges = [],
    vertexByPosition = new Map(),
    edgeByEnds = new Map();
  tiles.forEach((tile, tileId) => {
    const cx = 380 + Math.sqrt(3) * 69 * (tile.q + tile.row / 2);
    const cy = 350 + 103.5 * tile.row;
    for (let k = 0; k < 6; k++) {
      const angle = (Math.PI * (k * 60 - 90)) / 180;
      const x = cx + 69 * Math.cos(angle),
        y = cy + 69 * Math.sin(angle);
      const key = `${Math.round(x * 100)},${Math.round(y * 100)}`;
      if (!vertexByPosition.has(key)) {
        vertexByPosition.set(key, vertices.length);
        vertices.push({
          x,
          y,
          tiles: [],
          edges: [],
          neighbors: [],
          port: null,
        });
      }
      const id = vertexByPosition.get(key);
      tile.vertices.push(id);
      vertices[id].tiles.push(tileId);
    }
    for (let k = 0; k < 6; k++) {
      const a = tile.vertices[k],
        b = tile.vertices[(k + 1) % 6];
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
  // Traverse the coast; harbor endpoints must be separated by at least two other edges.
  const boundary = edges.flatMap((edge, i) =>
    edge.tiles.length === 1 ? [i] : [],
  );
  const neighbors = (i) =>
    boundary.filter(
      (j) =>
        j !== i &&
        [edges[i].a, edges[i].b].some(
          (v) => v === edges[j].a || v === edges[j].b,
        ),
    );
  const ordered = [boundary[0]];
  while (ordered.length < boundary.length) {
    const candidates = neighbors(ordered.at(-1)).filter(
      (i) => !ordered.includes(i),
    );
    if (!candidates.length) break;
    ordered.push(candidates.find((i) => i !== ordered.at(-2)) ?? candidates[0]);
  }
  if (ordered.length !== 30)
    throw new Error('Island coastline must contain 30 connected edges.');
  const ports = portMode === 'fixed' ? HARBORS : shuffled(HARBORS, random);
  const positions =
    portMode === 'fixed'
      ? Array.from(
          { length: 9 },
          (_, i) => (ordered.length - i * 3) % ordered.length,
        )
      : (() => {
          const gaps = shuffled([3, 3, 3, 3, 3, 3, 4, 4, 4], random);
          const start = Math.floor(random() * ordered.length);
          let position = start;
          return gaps.map((gap) => {
            const current = position;
            position = (position + gap) % ordered.length;
            return current;
          });
        })();
  for (let i = 0; i < 9; i++) {
    const edge = edges[ordered[positions[i]]];
    edge.port = ports[i];
    vertices[edge.a].port = ports[i];
    vertices[edge.b].port = ports[i];
  }
  return { tiles, vertices, edges };
}

function validHarbors(board) {
  if (!Array.isArray(board?.edges) || !Array.isArray(board?.vertices))
    return false;
  const ports = board.edges.filter((edge) => edge?.port);
  if (
    ports.length !== HARBORS.length ||
    ports
      .map((edge) => edge.port)
      .sort()
      .join(',') !== [...HARBORS].sort().join(',')
  )
    return false;
  const docks = new Map();
  for (const edge of ports) {
    if (
      edge.tiles?.length !== 1 ||
      !integer(edge.a) ||
      !integer(edge.b) ||
      edge.a >= board.vertices.length ||
      edge.b >= board.vertices.length ||
      docks.has(edge.a) ||
      docks.has(edge.b)
    )
      return false;
    docks.set(edge.a, edge.port);
    docks.set(edge.b, edge.port);
  }
  return board.vertices.every(
    (vertex, index) => vertex?.port === (docks.get(index) ?? null),
  );
}

export function newCatan(
  count = 3,
  random = Math.random,
  portMode = 'fixed',
  boardOptions = DEFAULT_BOARD_OPTIONS,
) {
  if (!integer(count, 3) || count > 4)
    throw new RangeError('Island Charter needs 3–4 players.');
  const board = createIsland(random, portMode, boardOptions);
  return {
    board,
    portMode,
    boardOptions: { ...boardOptions },
    buildings: Array(board.vertices.length).fill(null),
    roads: Array(board.edges.length).fill(null),
    players: Array.from({ length: count }, () => ({
      goods: emptyGoods(),
      dev: [],
      roads: 0,
      settlements: 0,
      cities: 0,
      knights: 0,
    })),
    bank: Object.fromEntries(GOODS.map((g) => [g, 19])),
    deck: shuffled(DECK, random),
    robber: board.tiles.findIndex((t) => t.terrain === 'desert'),
    current: 0,
    setupStep: 0,
    setupVertex: null,
    phase: 'setup-roll',
    setupRolls: Array(count).fill(null),
    setupOrder: null,
    rolled: null,
    discards: [],
    robberReturn: 'main',
    freeRoads: 0,
    devPlayed: false,
    turn: 0,
    longest: null,
    largest: null,
    offer: null,
    roadsReturn: 'main',
    winner: null,
    message: 'Roll to determine the opening placement order.',
  };
}

export function longestRoad(state, player) {
  const roads = state.roads.flatMap((owner, id) =>
    owner === player ? [id] : [],
  );
  let best = 0;
  const walk = (vertex, used) => {
    best = Math.max(best, used.size);
    if (
      used.size &&
      state.buildings[vertex] &&
      state.buildings[vertex].owner !== player
    )
      return;
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
  const leaders = values.flatMap((n, i) => (n === max ? [i] : []));
  state[key] =
    max < threshold
      ? null
      : leaders.includes(state[key])
        ? state[key]
        : leaders.length === 1
          ? leaders[0]
          : null;
}
export function points(state, player) {
  const p = state.players[player];
  return (
    p.settlements +
    2 * p.cities +
    p.dev.filter((c) => c.type === 'victory').length +
    2 * (state.longest === player) +
    2 * (state.largest === player)
  );
}
function updateAwards(state) {
  award(
    state,
    'longest',
    state.players.map((_, i) => longestRoad(state, i)),
    5,
  );
  award(
    state,
    'largest',
    state.players.map((p) => p.knights),
    3,
  );
  if (
    ![
      'setup-settlement',
      'setup-road',
      'discard',
      'robber',
      'free-roads',
    ].includes(state.phase) &&
    points(state, state.current) >= 10
  ) {
    state.winner = state.current;
    state.message = `Player ${state.current + 1} founded a flourishing island!`;
  }
}
function hasGoods(p, cost) {
  return GOODS.every((g) => p.goods[g] >= (cost[g] || 0));
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
  if (
    !integer(vertex) ||
    vertex >= state.buildings.length ||
    state.buildings[vertex] ||
    state.board.vertices[vertex].neighbors.some((n) => state.buildings[n])
  )
    return false;
  return (
    setup ||
    state.board.vertices[vertex].edges.some((e) => state.roads[e] === player)
  );
}
export function canRoad(state, player, edge, setup = false) {
  if (
    !integer(edge) ||
    edge >= state.roads.length ||
    state.roads[edge] !== null
  )
    return false;
  const { a, b } = state.board.edges[edge];
  if (setup) return a === state.setupVertex || b === state.setupVertex;
  return [a, b].some(
    (v) =>
      state.buildings[v]?.owner === player ||
      (!state.buildings[v] &&
        state.board.vertices[v].edges.some((e) => state.roads[e] === player)),
  );
}
function produce(state, number) {
  const demand = Object.fromEntries(GOODS.map((g) => [g, new Map()]));
  state.board.tiles.forEach((tile, id) => {
    if (tile.number !== number || state.robber === id) return;
    const good = YIELDS[tile.terrain];
    tile.vertices.forEach((v) => {
      const building = state.buildings[v];
      if (building)
        demand[good].set(
          building.owner,
          (demand[good].get(building.owner) || 0) + (building.city ? 2 : 1),
        );
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
    state.buildings[i]?.owner === player && v.port ? [v.port] : [],
  );
  return ports.includes(good) ? 2 : ports.includes('any') ? 3 : 4;
}
function robberVictims(state, tile) {
  return [
    ...new Set(
      state.board.tiles[tile].vertices.flatMap((v) => {
        const owner = state.buildings[v]?.owner;
        return owner !== undefined &&
          owner !== state.current &&
          SUM(state.players[owner].goods) > 0
          ? [owner]
          : [];
      }),
    ),
  ];
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
export function actCatan(
  state,
  action,
  actor = state.current,
  random = Math.random,
) {
  if (
    !state ||
    !action ||
    typeof action !== 'object' ||
    !integer(actor) ||
    actor >= state.players.length ||
    state.winner !== null
  )
    return false;
  const p = state.players[actor],
    phase = state.phase;
  const type = action.type;
  if (type === 'setup-roll') {
    if (
      phase !== 'setup-roll' ||
      actor !== state.current ||
      !Array.isArray(action.dice) ||
      action.dice.length !== 2 ||
      !action.dice.every((value) => integer(value, 1) && value <= 6)
    )
      return false;
    state.setupRolls[actor] = action.dice[0] + action.dice[1];
    const next = state.setupRolls.indexOf(null);
    if (next >= 0) {
      state.current = next;
      state.message = 'Roll to determine the opening placement order.';
    } else {
      const totals = state.setupRolls;
      const tied = totals.map(
        (value, index) =>
          totals.indexOf(value) !== index ||
          totals.lastIndexOf(value) !== index,
      );
      if (tied.some(Boolean)) {
        tied.forEach((isTied, index) => {
          if (isTied) totals[index] = null;
        });
        state.current = totals.indexOf(null);
        state.message = 'Tied rolls! Only tied navigators roll again.';
      } else {
        state.setupOrder = totals
          .map((_, index) => index)
          .sort((a, b) => totals[b] - totals[a]);
        state.current = state.setupOrder[0];
        state.phase = 'setup-settlement';
        state.message =
          'Highest roll places first. The last navigator places twice in a row.';
      }
    }
    return true;
  }
  if (type === 'discard') {
    if (
      phase !== 'discard' ||
      !state.discards[actor] ||
      !validGoods(action.goods) ||
      SUM(action.goods) !== state.discards[actor] ||
      !hasGoods(p, action.goods)
    )
      return false;
    pay(state, actor, action.goods);
    state.discards[actor] = 0;
    if (state.discards.every((n) => n === 0)) state.phase = 'robber';
    state.message = 'Return half your cargo; the raider moves next.';
    return true;
  }
  if (actor !== state.current) return false;
  if (type === 'setup-settlement') {
    if (
      phase !== 'setup-settlement' ||
      !canSettle(state, actor, action.vertex, true)
    )
      return false;
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
    if (phase !== 'setup-road' || !canRoad(state, actor, action.edge, true))
      return false;
    state.roads[action.edge] = actor;
    p.roads++;
    state.setupVertex = null;
    state.setupStep++;
    const n = state.players.length;
    if (state.setupStep === 2 * n) {
      state.current = state.setupOrder[0];
      state.phase = 'roll';
      state.turn = 1;
      state.message = 'First voyage: roll both dice.';
    } else {
      state.current =
        state.setupOrder[
          state.setupStep < n ? state.setupStep : 2 * n - 1 - state.setupStep
        ];
      state.phase = 'setup-settlement';
      state.message = 'Place your outpost.';
    }
    return true;
  }
  if (type === 'robber') {
    if (
      phase !== 'robber' ||
      !integer(action.tile) ||
      action.tile >= state.board.tiles.length ||
      action.tile === state.robber ||
      !(
        action.victim === null ||
        (integer(action.victim) &&
          robberVictims(state, action.tile).includes(action.victim))
      )
    )
      return false;
    const victims = robberVictims(state, action.tile);
    if (victims.length && action.victim === null) return false;
    state.robber = action.tile;
    if (action.victim !== null) steal(state, action.victim, random);
    state.phase = state.robberReturn;
    state.message =
      action.victim === null
        ? 'The raider blocks that land.'
        : 'One hidden cargo was taken.';
    updateAwards(state);
    return true;
  }
  if (type === 'roll') {
    if (
      phase !== 'roll' ||
      !Array.isArray(action.dice) ||
      action.dice.length !== 2 ||
      !integer(action.dice[0], 1) ||
      !integer(action.dice[1], 1) ||
      action.dice[0] > 6 ||
      action.dice[1] > 6
    )
      return false;
    state.rolled = action.dice;
    const total = action.dice[0] + action.dice[1];
    if (total === 7) {
      state.discards = state.players.map((player) =>
        SUM(player.goods) > 7 ? Math.floor(SUM(player.goods) / 2) : 0,
      );
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
    if (
      !['roll', 'main'].includes(phase) ||
      state.devPlayed ||
      !['knight', 'roads', 'plenty', 'monopoly'].includes(action.card)
    )
      return false;
    const index = p.dev.findIndex(
      (c) => c.type === action.card && c.bought < state.turn,
    );
    if (index < 0) return false;
    if (action.card === 'plenty') {
      if (
        !validGoods(action.goods) ||
        SUM(action.goods) !== 2 ||
        !hasGoods({ goods: state.bank }, action.goods)
      )
        return false;
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
      state.freeRoads = Math.min(
        2,
        15 - p.roads,
        state.roads.filter((r) => r === null).length,
      );
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
    if (
      p.roads >= 15 ||
      !canRoad(state, actor, action.edge) ||
      (phase === 'free-roads' && !state.freeRoads) ||
      (!state.freeRoads && !hasGoods(p, COSTS.road))
    )
      return false;
    if (state.freeRoads) state.freeRoads--;
    else pay(state, actor, COSTS.road);
    state.roads[action.edge] = actor;
    p.roads++;
    if (!state.freeRoads && phase === 'free-roads')
      state.phase = state.roadsReturn;
    state.message = 'A new path crosses the island.';
  } else if (type === 'skip-free-roads') {
    if (!state.freeRoads) return false;
    state.freeRoads = 0;
    if (phase === 'free-roads') state.phase = state.roadsReturn;
    state.message = 'You passed on the remaining free roads.';
  } else if (phase === 'free-roads') return false;
  else if (type === 'build-settlement') {
    if (
      state.freeRoads ||
      p.settlements >= 5 ||
      !canSettle(state, actor, action.vertex) ||
      !hasGoods(p, COSTS.settlement)
    )
      return false;
    pay(state, actor, COSTS.settlement);
    state.buildings[action.vertex] = { owner: actor, city: false };
    p.settlements++;
    state.message = 'A new outpost takes root.';
  } else if (type === 'build-city') {
    const existing = state.buildings[action.vertex];
    if (
      state.freeRoads ||
      !integer(action.vertex) ||
      !existing ||
      existing.owner !== actor ||
      existing.city ||
      p.cities >= 4 ||
      !hasGoods(p, COSTS.city)
    )
      return false;
    pay(state, actor, COSTS.city);
    existing.city = true;
    p.cities++;
    p.settlements--;
    state.message = 'Your outpost grew into a city.';
  } else if (type === 'buy-dev') {
    if (
      state.freeRoads ||
      !state.deck.length ||
      !hasGoods(p, COSTS.development)
    )
      return false;
    pay(state, actor, COSTS.development);
    p.dev.push({ type: state.deck.pop(), bought: state.turn });
    state.message = 'A discovery joins your private hand.';
  } else if (type === 'bank-trade') {
    if (
      state.freeRoads ||
      !isGood(action.give) ||
      !isGood(action.receive) ||
      action.give === action.receive ||
      !integer(action.quantity, 1) ||
      action.quantity > 19 ||
      action.quantity * tradeRate(state, actor, action.give) >
        p.goods[action.give] ||
      action.quantity > state.bank[action.receive]
    )
      return false;
    const amount = action.quantity * tradeRate(state, actor, action.give);
    pay(state, actor, { [action.give]: amount });
    transfer(state, actor, { [action.receive]: action.quantity });
    state.message = 'Cargo exchanged at the harbor.';
  } else if (type === 'offer') {
    if (
      state.freeRoads ||
      !integer(action.to) ||
      action.to >= state.players.length ||
      action.to === actor ||
      !validGoods(action.give) ||
      !validGoods(action.want) ||
      !hasGoods(p, action.give)
    )
      return false;
    state.offer = {
      from: actor,
      to: action.to,
      give: { ...action.give },
      want: { ...action.want },
    };
    state.message = `Player ${actor + 1} offered a cargo exchange to Player ${action.to + 1}.`;
  } else if (type === 'cancel-offer') {
    if (!state.offer) return false;
    state.offer = null;
    state.message = 'Trade proposal withdrawn.';
  } else if (type === 'end') {
    if (state.freeRoads) return false;
    state.offer = null;
    state.current = (actor + 1) % state.players.length;
    state.phase = 'roll';
    state.rolled = null;
    state.devPlayed = false;
    state.turn++;
    state.message = `Player ${state.current + 1}: roll to begin.`;
  } else return false;
  updateAwards(state);
  return true;
}

export function actTradeReply(state, action, actor) {
  const offer = state?.offer;
  if (
    !offer ||
    state.phase !== 'main' ||
    state.winner !== null ||
    actor !== offer.to ||
    !['accept', 'decline'].includes(action?.type)
  )
    return false;
  if (action.type === 'accept') {
    const from = state.players[offer.from],
      to = state.players[actor];
    if (!hasGoods(from, offer.give) || !hasGoods(to, offer.want)) return false;
    for (const good of GOODS) {
      from.goods[good] += (offer.want[good] || 0) - (offer.give[good] || 0);
      to.goods[good] += (offer.give[good] || 0) - (offer.want[good] || 0);
    }
  }
  state.message =
    action.type === 'accept'
      ? 'Cargo changed hands.'
      : 'Trade proposal declined.';
  state.offer = null;
  return true;
}

export function applyRemoteCatanAction(
  state,
  request,
  revision,
  from,
  playerIds,
  random = Math.random,
  hostDice = null,
) {
  if (
    request?.type !== 'ct-request' ||
    request.revision !== revision ||
    !Array.isArray(playerIds) ||
    !request.move ||
    typeof request.move !== 'object'
  )
    return false;
  const actor = playerIds.indexOf(from);
  if (actor < 0) return false;
  const move = ['roll', 'setup-roll'].includes(request.move.type)
    ? { type: request.move.type, dice: hostDice ?? rollDiceValues(2, random) }
    : request.move;
  return ['accept', 'decline'].includes(move.type)
    ? actTradeReply(state, move, actor)
    : actCatan(state, move, actor, random);
}

export function validCatanCheckpoint(state, allowFinished = false) {
  const legacySetup =
    state?.setupRolls === undefined &&
    state?.setupOrder === undefined &&
    state?.phase !== 'setup-roll';
  if (
    !state ||
    !Array.isArray(state.players) ||
    ![3, 4].includes(state.players.length) ||
    !(state.portMode === undefined || PORT_MODES.includes(state.portMode)) ||
    !(
      state.boardOptions === undefined || validBoardOptions(state.boardOptions)
    ) ||
    !(
      state.winner === null ||
      (allowFinished &&
        integer(state.winner) &&
        state.winner < state.players.length)
    ) ||
    ![
      'setup-roll',
      'setup-settlement',
      'setup-road',
      'roll',
      'discard',
      'robber',
      'main',
      'free-roads',
    ].includes(state.phase) ||
    !integer(state.current) ||
    state.current >= state.players.length ||
    !integer(state.turn) ||
    !integer(state.setupStep) ||
    state.setupStep > 2 * state.players.length ||
    (state.roomRound !== undefined &&
      (!Number.isSafeInteger(state.roomRound) || state.roomRound < 0)) ||
    (!legacySetup &&
      (!Array.isArray(state.setupRolls) ||
        state.setupRolls.length !== state.players.length ||
        state.setupRolls.some(
          (value) => value !== null && (!integer(value, 2) || value > 12),
        ) ||
        !(
          (state.setupOrder === null && state.phase === 'setup-roll') ||
          (Array.isArray(state.setupOrder) &&
            state.setupOrder.length === state.players.length &&
            new Set(state.setupOrder).size === state.players.length &&
            state.setupOrder.every(
              (value) => integer(value) && value < state.players.length,
            ))
        ))) ||
    !integer(state.robber) ||
    state.robber >= 19 ||
    !integer(state.freeRoads) ||
    state.freeRoads > 2 ||
    !Array.isArray(state.deck) ||
    state.deck.length > 25 ||
    state.deck.some((card) => !DECK.includes(card)) ||
    !Array.isArray(state.board?.tiles) ||
    state.board.tiles.length !== 19 ||
    !Array.isArray(state.board?.vertices) ||
    state.board.vertices.length !== 54 ||
    !Array.isArray(state.board?.edges) ||
    state.board.edges.length !== 72 ||
    !validHarbors(state.board) ||
    state.board.tiles.some(
      (t) =>
        !Array.isArray(t?.vertices) ||
        t.vertices.length !== 6 ||
        t.vertices.some((v) => !integer(v) || v >= 54),
    ) ||
    state.board.vertices.some(
      (v) =>
        !Array.isArray(v?.edges) ||
        !Array.isArray(v.neighbors) ||
        !Array.isArray(v.tiles) ||
        !Number.isFinite(v.x) ||
        !Number.isFinite(v.y) ||
        v.edges.some((e) => !integer(e) || e >= 72) ||
        v.neighbors.some((n) => !integer(n) || n >= 54),
    ) ||
    state.board.edges.some(
      (e) => !integer(e?.a) || !integer(e?.b) || e.a >= 54 || e.b >= 54,
    ) ||
    !Array.isArray(state.buildings) ||
    state.buildings.length !== 54 ||
    state.buildings.some(
      (b) =>
        b !== null &&
        (!integer(b?.owner) ||
          b.owner >= state.players.length ||
          typeof b.city !== 'boolean'),
    ) ||
    !Array.isArray(state.roads) ||
    state.roads.length !== 72 ||
    state.roads.some(
      (r) => r !== null && (!integer(r) || r >= state.players.length),
    ) ||
    !Array.isArray(state.discards) ||
    state.discards.some((n) => !integer(n)) ||
    (state.phase === 'discard' &&
      state.discards.length !== state.players.length) ||
    !(
      state.setupVertex === null ||
      (integer(state.setupVertex) && state.setupVertex < 54)
    ) ||
    !(
      state.offer === null ||
      (state.offer &&
        integer(state.offer.from) &&
        integer(state.offer.to) &&
        state.offer.from === state.current &&
        state.offer.to < state.players.length &&
        state.offer.to !== state.current &&
        validGoods(state.offer.give) &&
        validGoods(state.offer.want))
    ) ||
    !['roll', 'main'].includes(state.roadsReturn) ||
    ![null, ...state.players.map((_, i) => i)].includes(state.longest) ||
    ![null, ...state.players.map((_, i) => i)].includes(state.largest) ||
    typeof state.devPlayed !== 'boolean' ||
    typeof state.message !== 'string' ||
    state.message.length > 200 ||
    !GOODS.every((g) => integer(state.bank?.[g]) && state.bank[g] <= 19)
  )
    return false;
  return (
    state.players.every(
      (p, i) =>
        p &&
        integer(p.roads) &&
        p.roads <= 15 &&
        integer(p.settlements) &&
        p.settlements <= 5 &&
        integer(p.cities) &&
        p.cities <= 4 &&
        integer(p.knights) &&
        p.roads === state.roads.filter((owner) => owner === i).length &&
        p.settlements ===
          state.buildings.filter((b) => b?.owner === i && !b.city).length &&
        p.cities ===
          state.buildings.filter((b) => b?.owner === i && b.city).length &&
        Array.isArray(p.dev) &&
        p.dev.every((c) => DECK.includes(c?.type) && integer(c.bought)) &&
        GOODS.every((g) => integer(p.goods?.[g])),
    ) &&
    GOODS.every(
      (g) =>
        state.bank[g] + state.players.reduce((n, p) => n + p.goods[g], 0) ===
        19,
    )
  );
}

export function catanView(state, player) {
  return {
    board: state.board,
    portMode: state.portMode ?? 'shuffled',
    boardOptions: state.boardOptions ?? LEGACY_BOARD_OPTIONS,
    buildings: state.buildings,
    roads: state.roads,
    goods: { ...state.players[player].goods },
    dev: state.players[player].dev.map((c) => ({ ...c })),
    counts: state.players.map((p) => ({
      goods: SUM(p.goods),
      dev: p.dev.length,
      roads: p.roads,
      settlements: p.settlements,
      cities: p.cities,
      knights: p.knights,
    })),
    bank: { ...state.bank },
    deckCount: state.deck.length,
    robber: state.robber,
    current: state.current,
    phase: state.phase,
    setupStep: state.setupStep,
    setupRolls: state.setupRolls,
    setupOrder: state.setupOrder,
    setupVertex: state.setupVertex,
    rolled: state.rolled,
    discards: state.discards,
    robberReturn: state.robberReturn,
    freeRoads: state.freeRoads,
    devPlayed: state.devPlayed,
    turn: state.turn,
    longest: state.longest,
    largest: state.largest,
    offer: state.offer,
    scores: state.players.map(
      (_, i) =>
        state.players[i].settlements +
        2 * state.players[i].cities +
        2 * (state.longest === i) +
        2 * (state.largest === i),
    ),
    myScore: points(state, player),
    winner: state.winner,
    message: state.message,
  };
}
