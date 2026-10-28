import { BOARD, DEEDS, GROUPS, actors } from './business-core.js';
import type { BusinessAction, BusinessPublic } from './business-core.js';
export function businessResponder(s: BusinessPublic): number {
  return s.offer?.to ?? actors(s)[0] ?? s.current;
}
const moveKeys: Record<string, string[]> = {
  roll: [],
  buy: [],
  decline: [],
  end: [],
  'jail-fine': [],
  'jail-card': ['card'],
  bid: ['amount'],
  pass: [],
  build: ['id', 'kind'],
  sell: ['id'],
  liquidate: ['group'],
  mortgage: ['id'],
  release: ['id'],
  'pay-debt': [],
  bankrupt: [],
  'place-award': ['id'],
  offer: [
    'to',
    'offered',
    'wanted',
    'cashOut',
    'cashIn',
    'cardsOut',
    'cardsIn',
  ],
  counter: [
    'to',
    'offered',
    'wanted',
    'cashOut',
    'cashIn',
    'cardsOut',
    'cardsIn',
  ],
  accept: [],
  reject: [],
  cancel: [],
};
export function validBusinessMove(value: unknown): value is BusinessAction {
  const m = value as BusinessAction;
  return (
    !!m &&
    typeof m === 'object' &&
    !Array.isArray(m) &&
    Object.hasOwn(moveKeys, m.type) &&
    Object.keys(m).every((k) => k === 'type' || moveKeys[m.type].includes(k)) &&
    JSON.stringify(m).length < 2000 &&
    (m.id === undefined || DEEDS.includes(m.id)) &&
    (m.amount === undefined ||
      (Number.isSafeInteger(m.amount) && m.amount >= 0 && m.amount <= 1e7)) &&
    (m.to === undefined || (Number.isInteger(m.to) && m.to >= 0 && m.to < 6)) &&
    (['offered', 'wanted'] as const).every(
      (k) =>
        m[k] === undefined ||
        (Array.isArray(m[k]) &&
          m[k]!.length <= 28 &&
          m[k]!.every((id) => DEEDS.includes(id))),
    ) &&
    (['cashOut', 'cashIn', 'cardsOut', 'cardsIn'] as const).every(
      (k) =>
        m[k] === undefined ||
        (Number.isSafeInteger(m[k]) && m[k]! >= 0 && m[k]! < 1e7),
    ) &&
    (m.card === undefined || ['fortune', 'fund'].includes(m.card)) &&
    (m.kind === undefined || ['house', 'hotel'].includes(m.kind)) &&
    (m.group === undefined || Object.hasOwn(GROUPS, m.group)) &&
    (!['build', 'place-award', 'sell', 'mortgage', 'release'].includes(
      m.type,
    ) ||
      (m.id !== undefined && DEEDS.includes(m.id))) &&
    (m.type !== 'build' ||
      (m.kind !== undefined && ['house', 'hotel'].includes(m.kind))) &&
    (m.type !== 'liquidate' || (!!m.group && Object.hasOwn(GROUPS, m.group))) &&
    (m.type !== 'bid' || (Number.isSafeInteger(m.amount) && m.amount! > 0)) &&
    (!['offer', 'counter'].includes(m.type) ||
      (Number.isInteger(m.to) &&
        Array.isArray(m.offered) &&
        Array.isArray(m.wanted) &&
        (['cashOut', 'cashIn', 'cardsOut', 'cardsIn'] as const).every(
          (k) => Number.isSafeInteger(m[k]) && m[k]! >= 0,
        )))
  );
}
export function deedActions(
  s: BusinessPublic,
  player: number,
  id: number,
): { label: string; move: BusinessAction }[] {
  const d = s.deeds[id],
    space = BOARD[id];
  if (!d || d.owner !== player || s.players[player].out) return [];
  const actions: { label: string; move: BusinessAction }[] = [],
    peers = space.group
      ? DEEDS.filter((x) => BOARD[x].group === space.group)
      : [],
    levels = peers.map((x) => s.deeds[x].level),
    clear = peers.every((x) => !s.deeds[x].mortgaged),
    complete = peers.every((x) => s.deeds[x].owner === player);
  if (
    d.level > 0 &&
    d.level === Math.max(...levels) &&
    (d.level < 5 || s.houses >= 4)
  )
    actions.push({ label: 'Sell building', move: { type: 'sell', id } });
  if (
    space.group &&
    complete &&
    clear &&
    s.players[player].cash >= (space.cost ?? Infinity)
  ) {
    if (d.level < 4 && d.level === Math.min(...levels) && s.houses > 0)
      actions.push({
        label: `Build house · ₹${space.cost}`,
        move: { type: 'build', id, kind: 'house' },
      });
    if (d.level === 4 && levels.every((n) => n >= 4) && s.hotels > 0)
      actions.push({
        label: `Build hotel · ₹${space.cost}`,
        move: { type: 'build', id, kind: 'hotel' },
      });
  }
  if (d.mortgaged) {
    const price = Math.ceil(space.price! * 0.55);
    if (s.players[player].cash >= price)
      actions.push({
        label: `Repay · ₹${price}`,
        move: { type: 'release', id },
      });
  } else if (!space.group || levels.every((n) => n === 0))
    actions.push({
      label: `Mortgage · +₹${space.price! / 2}`,
      move: { type: 'mortgage', id },
    });
  return actions;
}
export function awardChoices(s: BusinessPublic, player: number): number[] {
  if (s.phase !== 'award' || s.auction?.bidder !== player) return [];
  return DEEDS.filter(
    (id) =>
      s.deeds[id].owner === player &&
      (BOARD[id].cost ?? Infinity) <= s.auction!.bid &&
      deedActions(s, player, id).some(
        (a) => a.move.type === 'build' && a.move.kind === s.auction!.kind,
      ),
  );
}
