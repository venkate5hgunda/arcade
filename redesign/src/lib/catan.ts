import { GOODS } from './catan-core.js';
import type { IslandAction, IslandView } from './catan-core.js';

const whole = (value: unknown, max: number) =>
  Number.isSafeInteger(value) &&
  (value as number) >= 0 &&
  (value as number) <= max;
const goods = (value: unknown) =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).every(
    (key) =>
      GOODS.includes(key as (typeof GOODS)[number]) &&
      whole((value as Record<string, unknown>)[key], 19),
  );
const keys: Record<string, string[]> = {
  'setup-roll': [],
  roll: [],
  'setup-settlement': ['vertex'],
  'setup-road': ['edge'],
  discard: ['goods'],
  robber: ['tile', 'victim'],
  'build-road': ['edge'],
  'skip-free-roads': [],
  'build-settlement': ['vertex'],
  'build-city': ['vertex'],
  'buy-dev': [],
  'bank-trade': ['give', 'receive', 'quantity'],
  offer: ['to', 'give', 'want'],
  'cancel-offer': [],
  'play-dev': ['card', 'goods', 'good'],
  accept: [],
  decline: [],
  end: [],
};
export function validIslandMove(value: unknown): value is IslandAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const m = value as Record<string, unknown>;
  if (
    typeof m.type !== 'string' ||
    !Object.hasOwn(keys, m.type) ||
    !Object.keys(m).every(
      (k) => k === 'type' || keys[m.type as string].includes(k),
    ) ||
    JSON.stringify(m).length > 1000
  )
    return false;
  if (
    ['setup-settlement', 'build-settlement', 'build-city'].includes(m.type) &&
    !whole(m.vertex, 53)
  )
    return false;
  if (['setup-road', 'build-road'].includes(m.type) && !whole(m.edge, 71))
    return false;
  if (
    m.type === 'robber' &&
    (!whole(m.tile, 18) || !(m.victim === null || whole(m.victim, 3)))
  )
    return false;
  if (m.type === 'discard' && !goods(m.goods)) return false;
  if (
    m.type === 'bank-trade' &&
    (!GOODS.includes(m.give as (typeof GOODS)[number]) ||
      !GOODS.includes(m.receive as (typeof GOODS)[number]) ||
      !whole(m.quantity, 19) ||
      m.quantity === 0)
  )
    return false;
  if (
    m.type === 'offer' &&
    (!whole(m.to, 3) || !goods(m.give) || !goods(m.want))
  )
    return false;
  if (
    m.type === 'play-dev' &&
    (!['knight', 'roads', 'plenty', 'monopoly'].includes(m.card as string) ||
      (m.card === 'plenty' && !goods(m.goods)) ||
      (m.card === 'monopoly' &&
        !GOODS.includes(m.good as (typeof GOODS)[number])))
  )
    return false;
  return true;
}
export function validIslandView(
  value: unknown,
  count: number,
): value is IslandView {
  const v = value as IslandView;
  if (
    !v ||
    typeof v !== 'object' ||
    Array.isArray(v) ||
    !Object.keys(v).every((k) =>
      [
        'board',
        'portMode',
        'boardOptions',
        'buildings',
        'roads',
        'goods',
        'dev',
        'counts',
        'bank',
        'deckCount',
        'robber',
        'current',
        'phase',
        'setupStep',
        'setupRolls',
        'setupOrder',
        'setupVertex',
        'rolled',
        'discards',
        'robberReturn',
        'freeRoads',
        'devPlayed',
        'turn',
        'longest',
        'largest',
        'offer',
        'scores',
        'myScore',
        'winner',
        'message',
      ].includes(k),
    )
  )
    return false;
  if (
    !v.board ||
    !Array.isArray(v.board.tiles) ||
    v.board.tiles.length !== 19 ||
    !Array.isArray(v.board.vertices) ||
    v.board.vertices.length !== 54 ||
    !Array.isArray(v.board.edges) ||
    v.board.edges.length !== 72
  )
    return false;
  if (
    !v.board.tiles.every(
      (t) =>
        t &&
        [
          'forest',
          'hills',
          'fields',
          'pasture',
          'mountains',
          'desert',
        ].includes(t.terrain) &&
        Array.isArray(t.vertices) &&
        t.vertices.length === 6 &&
        t.vertices.every((n) => whole(n, 53)) &&
        (t.number === null || whole(t.number, 12)),
    )
  )
    return false;
  if (
    !v.board.vertices.every(
      (p) =>
        p &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        Array.isArray(p.tiles) &&
        p.tiles.every((n) => whole(n, 18)) &&
        Array.isArray(p.edges) &&
        p.edges.every((n) => whole(n, 71)) &&
        Array.isArray(p.neighbors) &&
        p.neighbors.every((n) => whole(n, 53)) &&
        (p.port === null || p.port === 'any' || GOODS.includes(p.port)),
    )
  )
    return false;
  if (
    !v.board.edges.every(
      (e) =>
        e &&
        whole(e.a, 53) &&
        whole(e.b, 53) &&
        Array.isArray(e.tiles) &&
        e.tiles.every((n) => whole(n, 18)) &&
        (e.port === null || e.port === 'any' || GOODS.includes(e.port)),
    )
  )
    return false;
  if (
    !['fixed', 'shuffled'].includes(v.portMode) ||
    !v.boardOptions ||
    !['illustrated', 'colorblock'].includes(v.boardOptions.imageStyle) ||
    !(
      ['hotTouch', 'coldTouch', 'sameNumberTouch', 'sameResourceTouch'] as const
    ).every((k) => typeof v.boardOptions[k] === 'boolean')
  )
    return false;
  if (
    !Array.isArray(v.buildings) ||
    v.buildings.length !== 54 ||
    !v.buildings.every(
      (b) =>
        b === null ||
        (!!b && whole(b.owner, count - 1) && typeof b.city === 'boolean'),
    ) ||
    !Array.isArray(v.roads) ||
    v.roads.length !== 72 ||
    !v.roads.every((r) => r === null || whole(r, count - 1))
  )
    return false;
  if (
    !goods(v.goods) ||
    !goods(v.bank) ||
    !GOODS.every((g) => whole(v.goods[g], 19) && whole(v.bank[g], 19)) ||
    !Array.isArray(v.dev) ||
    !v.dev.every(
      (c) =>
        c &&
        ['knight', 'victory', 'roads', 'plenty', 'monopoly'].includes(c.type) &&
        whole(c.bought, 100000),
    ) ||
    !Array.isArray(v.counts) ||
    v.counts.length !== count ||
    !v.counts.every(
      (c) =>
        c &&
        ['goods', 'dev', 'roads', 'settlements', 'cities', 'knights'].every(
          (k) => whole((c as unknown as Record<string, unknown>)[k], 100),
        ),
    )
  )
    return false;
  return (
    whole(v.current, count - 1) &&
    whole(v.robber, 18) &&
    whole(v.deckCount, 25) &&
    whole(v.setupStep, count * 2) &&
    (v.setupVertex === null || whole(v.setupVertex, 53)) &&
    [
      'setup-roll',
      'setup-settlement',
      'setup-road',
      'roll',
      'discard',
      'robber',
      'main',
      'free-roads',
    ].includes(v.phase) &&
    Array.isArray(v.setupRolls) &&
    v.setupRolls.length === count &&
    v.setupRolls.every((n) => n === null || whole(n, 12)) &&
    (v.setupOrder === null ||
      (Array.isArray(v.setupOrder) &&
        v.setupOrder.length === count &&
        new Set(v.setupOrder).size === count &&
        v.setupOrder.every((n) => whole(n, count - 1)))) &&
    (v.rolled === null ||
      (Array.isArray(v.rolled) &&
        v.rolled.length === 2 &&
        v.rolled.every((n) => whole(n, 6) && n > 0))) &&
    Array.isArray(v.discards) &&
    v.discards.length <= count &&
    v.discards.every((n) => whole(n, 100)) &&
    whole(v.freeRoads, 2) &&
    typeof v.devPlayed === 'boolean' &&
    whole(v.turn, 100000) &&
    (v.longest === null || whole(v.longest, count - 1)) &&
    (v.largest === null || whole(v.largest, count - 1)) &&
    (v.winner === null || whole(v.winner, count - 1)) &&
    Array.isArray(v.scores) &&
    v.scores.length === count &&
    v.scores.every((n) => whole(n, 100)) &&
    whole(v.myScore, 100) &&
    typeof v.message === 'string' &&
    v.message.length <= 200 &&
    (v.offer === null ||
      (!!v.offer &&
        whole(v.offer.from, count - 1) &&
        whole(v.offer.to, count - 1) &&
        goods(v.offer.give) &&
        goods(v.offer.want)))
  );
}
