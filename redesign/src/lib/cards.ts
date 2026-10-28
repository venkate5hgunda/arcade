import { shuffledDeck, SUITS, RANKS } from './playing-cards.ts';
export { SUITS } from './playing-cards.ts';
import type { Card } from './playing-cards.ts';
import type { Random } from './puzzles.ts';
export type { Card };
export interface EightState {
  stock: Card[];
  discard: Card[];
  hands: Card[][];
  activeSuit: Card['suit'];
  current: number;
  phase: 'handoff' | 'play' | 'choose' | 'over';
  drawn: boolean;
  passes: number;
  pendingEight: number | null;
  winner: number | null;
  ending: '' | 'empty' | 'blocked';
  turn: number;
}
export type EightAction =
  | { type: 'play'; id: string }
  | { type: 'draw' | 'pass' }
  | { type: 'choose'; suit: Card['suit'] };
export interface UnoCard {
  id: number;
  color: 'red' | 'yellow' | 'green' | 'blue' | 'wild';
  value: string;
}
export interface UnoState {
  stock: UnoCard[];
  discard: UnoCard[];
  hands: UnoCard[][];
  color: UnoCard['color'];
  current: number;
  direction: number;
  drawnId: number | null;
  passes: number;
  winner: number | null;
  turn: number;
  challenge: { offender: number; illegal: boolean } | null;
  unoPending: number | null;
  unoDeclared: number | null;
}
export type UnoAction =
  | { type: 'play'; id: number; color?: UnoCard['color'] }
  | { type: 'draw' | 'pass' | 'uno' | 'catch' | 'accept' | 'challenge' };
export const eightDeck = shuffledDeck;

export function canPlay(card: Card, top: Card, activeSuit: Card['suit']) {
  return (
    card.rank === '8' || card.rank === top.rank || card.suit === activeSuit
  );
}

export function penalty(cards: Card[]) {
  return cards.reduce(
    (sum, card) =>
      sum +
      (card.rank === '8'
        ? 50
        : ['J', 'Q', 'K'].includes(card.rank)
          ? 10
          : card.rank === 'A'
            ? 1
            : Number(card.rank)),
    0,
  );
}

export function validCrazyEightsCheckpoint(
  value: unknown,
  allowFinished = false,
): value is EightState {
  const s = value as EightState;
  const finished = allowFinished && s?.phase === 'over';
  if (
    !s ||
    typeof s !== 'object' ||
    !Array.isArray(s.stock) ||
    !Array.isArray(s.discard) ||
    s.discard.length < 1 ||
    !Array.isArray(s.hands) ||
    s.hands.length !== 2 ||
    s.hands.some(
      (hand, index) =>
        !Array.isArray(hand) ||
        (!hand.length &&
          !(finished && s.ending === 'empty' && s.winner === index)),
    ) ||
    !SUITS.includes(s.activeSuit) ||
    !Number.isInteger(s.current) ||
    s.current < 0 ||
    s.current > 1 ||
    !['handoff', 'play', 'choose', ...(allowFinished ? ['over'] : [])].includes(
      s.phase,
    ) ||
    typeof s.drawn !== 'boolean' ||
    !Number.isInteger(s.passes) ||
    s.passes < 0 ||
    s.passes > (finished ? 2 : 1) ||
    !Number.isSafeInteger(s.turn) ||
    s.turn < 1 ||
    (finished
      ? !['empty', 'blocked'].includes(s.ending) ||
        !(
          (s.winner === null && s.ending === 'blocked') ||
          (s.winner !== null && [0, 1].includes(s.winner))
        )
      : s.winner !== null || s.ending !== '') ||
    !(
      s.pendingEight === null ||
      (Number.isInteger(s.pendingEight) &&
        s.pendingEight >= 0 &&
        s.pendingEight < s.hands[s.current].length)
    ) ||
    (s.phase === 'choose') !== (s.pendingEight !== null) ||
    (s.phase === 'choose' &&
      s.hands[s.current][s.pendingEight!].rank !== '8') ||
    (s.phase === 'handoff' && s.drawn)
  )
    return false;
  const cards = [...s.stock, ...s.discard, ...s.hands[0], ...s.hands[1]];
  return (
    cards.length === 52 &&
    cards.every(
      (card) =>
        card &&
        typeof card === 'object' &&
        SUITS.includes(card.suit) &&
        RANKS.includes(card.rank),
    ) &&
    new Set(cards.map((card) => `${card.suit}:${card.rank}`)).size === 52
  );
}

export function newCrazyEightsGame(random: Random = Math.random): EightState {
  const stock = eightDeck(random);
  const hands: Card[][] = [[], []];
  for (let i = 0; i < 7; i++) for (const hand of hands) hand.push(stock.pop()!);
  const starterIndex = stock.map((card) => card.rank !== '8').lastIndexOf(true);
  const discard = [stock.splice(starterIndex, 1)[0]];
  return {
    stock,
    discard,
    hands,
    activeSuit: discard[0].suit,
    current: 0,
    phase: 'play',
    drawn: false,
    passes: 0,
    pendingEight: null,
    winner: null,
    ending: '',
    turn: 1,
  };
}

function shuffle(cards: Card[], random: Random) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function replenish(state: EightState, random: Random) {
  if (state.stock.length || state.discard.length <= 1) return;
  state.stock = shuffle(state.discard.slice(0, -1), random);
  state.discard = [state.discard.at(-1)!];
}

export function actCrazyEights(
  state: EightState,
  action: EightAction,
  random: Random = Math.random,
) {
  if (
    !state ||
    !action ||
    typeof action !== 'object' ||
    state.phase === 'over' ||
    state.phase === 'handoff'
  )
    return false;
  const expected = (
    {
      play: ['type', 'id'],
      draw: ['type'],
      pass: ['type'],
      choose: ['type', 'suit'],
    } as Record<string, string[]>
  )[action.type];
  if (
    !expected ||
    Object.keys(action).length !== expected.length ||
    !expected.every((key) => Object.hasOwn(action, key))
  )
    return false;
  const hand = state.hands[state.current];
  if (action.type === 'choose') {
    if (
      state.phase !== 'choose' ||
      state.pendingEight === null ||
      !SUITS.includes(action.suit)
    )
      return false;
    const card = hand.splice(state.pendingEight, 1)[0];
    state.discard.push(card);
    state.activeSuit = action.suit;
    state.pendingEight = null;
    state.passes = 0;
  } else if (action.type === 'play') {
    if (state.phase !== 'play' || typeof action.id !== 'string') return false;
    const index = hand.findIndex(
      (card) => `${card.suit}:${card.rank}` === action.id,
    );
    if (
      index < 0 ||
      !canPlay(hand[index], state.discard.at(-1)!, state.activeSuit)
    )
      return false;
    if (hand[index].rank === '8') {
      state.pendingEight = index;
      state.phase = 'choose';
      return true;
    }
    const card = hand.splice(index, 1)[0];
    state.discard.push(card);
    state.activeSuit = card.suit;
    state.passes = 0;
  } else if (action.type === 'draw') {
    if (
      state.phase !== 'play' ||
      state.drawn ||
      !(state.stock.length || state.discard.length > 1)
    )
      return false;
    replenish(state, random);
    hand.push(state.stock.pop()!);
    state.drawn = true;
    return true;
  } else if (action.type === 'pass') {
    if (
      state.phase !== 'play' ||
      (!state.drawn &&
        (state.stock.length ||
          state.discard.length > 1 ||
          hand.some((card) =>
            canPlay(card, state.discard.at(-1)!, state.activeSuit),
          )))
    )
      return false;
    state.passes++;
  } else return false;

  if (!hand.length) {
    state.winner = state.current;
    state.phase = 'over';
    state.ending = 'empty';
    return true;
  }
  replenish(state, random);
  if (state.passes === 2 && !state.stock.length) {
    const scores = state.hands.map(penalty);
    state.winner =
      scores[0] === scores[1] ? null : scores[0] < scores[1] ? 0 : 1;
    state.ending = 'blocked';
    state.phase = 'over';
  } else {
    state.current = 1 - state.current;
    state.turn++;
    state.drawn = false;
    state.pendingEight = null;
    state.phase = 'play';
  }
  return true;
}

export function crazyEightsView(state: EightState, player: number) {
  return {
    hand: state.hands[player].map((card) => ({ ...card })),
    counts: state.hands.map((hand) => hand.length),
    top: { ...state.discard.at(-1)! },
    activeSuit: state.activeSuit,
    current: state.current,
    phase:
      state.phase === 'over'
        ? 'over'
        : player === state.current
          ? state.phase
          : 'play',
    drawn: player === state.current ? state.drawn : false,
    canDraw: !!(state.stock.length || state.discard.length > 1),
    canPass:
      player === state.current &&
      (state.drawn ||
        (!(state.stock.length || state.discard.length > 1) &&
          !state.hands[player].some((card) =>
            canPlay(card, state.discard.at(-1)!, state.activeSuit),
          ))),
    stockCount: state.stock.length,
    turn: state.turn,
    winner: state.winner,
    ending: state.ending,
    scores:
      state.phase === 'over' && state.ending === 'blocked'
        ? state.hands.map(penalty)
        : null,
  };
}

export const COLORS: UnoCard['color'][] = ['red', 'yellow', 'green', 'blue'];
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 20;
// Tables larger than ten players need a second shuffled deck so the stock
// does not run dry before the first player empties a hand.
export const DOUBLE_DECK_AFTER = 10;
export function unoDeckCount(playerCount: number) {
  return playerCount > DOUBLE_DECK_AFTER ? 2 : 1;
}

function singleDeck(offset: number): UnoCard[] {
  const cards: UnoCard[] = [];
  for (const color of COLORS) {
    cards.push({ id: offset + cards.length, color, value: '0' });
    for (const value of [
      ...Array.from({ length: 9 }, (_, i) => String(i + 1)),
      'skip',
      'reverse',
      'draw2',
    ])
      for (let i = 0; i < 2; i++)
        cards.push({ id: offset + cards.length, color, value });
  }
  for (const value of ['wild', 'wild4'])
    for (let i = 0; i < 4; i++)
      cards.push({ id: offset + cards.length, color: 'wild', value });
  return cards;
}

export function unoDeck(playerCount = 4) {
  const decks = unoDeckCount(playerCount);
  const cards: UnoCard[] = [];
  for (let deck = 0; deck < decks; deck++)
    cards.push(...singleDeck(cards.length));
  return cards;
}

function shuffleUno(cards: UnoCard[], random: Random = Math.random) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function newUnoGame(
  count: number,
  random: Random = Math.random,
): UnoState {
  if (!Number.isInteger(count) || count < MIN_PLAYERS || count > MAX_PLAYERS)
    throw new RangeError(`UNO needs ${MIN_PLAYERS}–${MAX_PLAYERS} players.`);
  const stock = shuffleUno(unoDeck(count), random);
  const hands: UnoCard[][] = Array.from({ length: count }, () => []);
  for (let n = 0; n < 7; n++) for (const hand of hands) hand.push(stock.pop()!);
  const first = stock
    .map((card) => /^[0-9]$/.test(card.value))
    .lastIndexOf(true);
  const discard = [stock.splice(first, 1)[0]];
  return {
    stock,
    discard,
    hands,
    color: discard[0].color,
    current: 0,
    direction: 1,
    drawnId: null,
    passes: 0,
    winner: null,
    turn: 1,
    challenge: null,
    unoPending: null,
    unoDeclared: null,
  };
}

export function canPlayUno(
  state: UnoState,
  card: UnoCard | undefined,
  player = state.current,
) {
  if (
    !card ||
    state.winner !== null ||
    state.challenge ||
    player !== state.current ||
    (state.drawnId !== null && state.drawnId !== card.id)
  )
    return false;
  const hand = state.hands[player];
  if (!hand?.some((held) => held.id === card.id)) return false;
  return (
    card.color === 'wild' ||
    card.color === state.color ||
    card.value === state.discard.at(-1)!.value
  );
}

function next(state: UnoState, steps = 1) {
  const count = state.hands.length;
  state.current =
    (state.current + ((state.direction * steps) % count) + count) % count;
  state.drawnId = null;
  state.turn++;
}

export function recycleUno(state: UnoState, random: Random = Math.random) {
  if (state.stock.length || state.discard.length < 2) return;
  state.stock = shuffleUno(state.discard.slice(0, -1), random);
  state.discard = [state.discard.at(-1)!];
}

function drawCards(state: UnoState, count: number, random: Random) {
  let received = 0;
  for (let i = 0; i < count; i++) {
    recycleUno(state, random);
    if (!state.stock.length) break;
    state.hands[state.current].push(state.stock.pop()!);
    received++;
  }
  return received;
}

// Returns false without mutating state for every invalid action.
export function actUno(
  state: UnoState,
  action: UnoAction,
  random: Random = Math.random,
  actor = state.current,
) {
  if (state.winner !== null || !action || typeof action !== 'object')
    return false;
  if (action.type === 'uno') {
    if (
      state.unoPending !== actor &&
      (actor !== state.current || state.hands[actor]?.length !== 2)
    )
      return false;
    if (state.unoPending === actor) state.unoPending = null;
    else state.unoDeclared = actor;
    return true;
  }
  if (action.type === 'catch') {
    if (
      state.unoPending === null ||
      state.unoPending === actor ||
      actor !== state.current
    )
      return false;
    const current = state.current;
    state.current = state.unoPending;
    drawCards(state, 2, random);
    state.current = current;
    state.unoPending = null;
    return true;
  }
  if (actor !== state.current) return false;
  if (state.challenge) {
    if (action.type !== 'accept' && action.type !== 'challenge') return false;
    const { offender, illegal } = state.challenge;
    state.challenge = null;
    state.unoPending = null;
    if (action.type === 'challenge' && illegal) {
      const current = state.current;
      state.current = offender;
      drawCards(state, 4, random);
      state.current = current;
    } else {
      drawCards(state, action.type === 'challenge' ? 6 : 4, random);
      next(state);
    }
    if (!state.hands[offender].length) state.winner = offender;
    return true;
  }
  const hand = state.hands[state.current];
  if (action.type === 'play') {
    const card = hand.find((held) => held.id === action.id);
    if (
      !card ||
      !canPlayUno(state, card) ||
      (card.color === 'wild'
        ? !action.color || !COLORS.includes(action.color)
        : action.color !== undefined)
    )
      return false;
    const illegalDrawFour =
      card.value === 'wild4' && hand.some((held) => held.color === state.color);
    const declared = state.unoDeclared === state.current;
    const offender = state.current;
    if (state.unoPending !== null) state.unoPending = null;
    hand.splice(hand.indexOf(card), 1);
    state.discard.push(card);
    state.color = card.color === 'wild' ? action.color! : card.color;
    state.passes = 0;
    state.unoDeclared = null;
    if (hand.length === 1 && !declared) state.unoPending = offender;
    if (card.value === 'wild4') {
      next(state);
      state.challenge = { offender, illegal: illegalDrawFour };
      return true;
    }
    if (!hand.length) {
      state.winner = offender;
      state.drawnId = null;
      return true;
    }
    if (card.value === 'reverse') {
      state.direction *= -1;
      next(state, state.hands.length === 2 ? 2 : 1);
    } else if (card.value === 'skip') next(state, 2);
    else if (card.value === 'draw2' || card.value === 'wild4') {
      next(state);
      drawCards(state, card.value === 'draw2' ? 2 : 4, random);
      next(state);
    } else next(state);
    return true;
  }
  if (action.type === 'draw') {
    if (
      state.drawnId !== null ||
      !(state.stock.length || state.discard.length > 1)
    )
      return false;
    state.unoPending = null;
    drawCards(state, 1, random);
    state.drawnId = hand.at(-1)!.id;
    if (hand.length > 2) state.unoDeclared = null;
    state.passes = 0;
    return true;
  }
  if (action.type === 'pass') {
    if (
      state.drawnId === null &&
      (state.stock.length ||
        state.discard.length > 1 ||
        hand.some((card) => canPlayUno(state, card)))
    )
      return false;
    state.unoPending = null;
    state.unoDeclared = null;
    state.passes = state.drawnId === null ? state.passes + 1 : 0;
    if (state.passes >= state.hands.length) {
      const fewest = Math.min(...state.hands.map((cards) => cards.length));
      const leaders = state.hands.flatMap((cards, i) =>
        cards.length === fewest ? [i] : [],
      );
      state.winner = leaders.length === 1 ? leaders[0] : -1;
      state.drawnId = null;
    } else next(state);
    return true;
  }
  return false;
}

export function validUnoCheckpoint(
  value: unknown,
  allowFinished = false,
): value is UnoState {
  const s = value as UnoState;
  if (
    !s ||
    typeof s !== 'object' ||
    !Array.isArray(s.hands) ||
    s.hands.length < MIN_PLAYERS ||
    s.hands.length > MAX_PLAYERS ||
    s.hands.some(
      (hand, index) =>
        !Array.isArray(hand) ||
        (!hand.length &&
          s.challenge?.offender !== index &&
          !(allowFinished && s.winner === index)),
    ) ||
    !Array.isArray(s.stock) ||
    !Array.isArray(s.discard) ||
    !s.discard.length ||
    !COLORS.includes(s.color) ||
    !Number.isInteger(s.current) ||
    s.current < 0 ||
    s.current >= s.hands.length ||
    ![-1, 1].includes(s.direction) ||
    !(
      s.winner === null ||
      (allowFinished &&
        Number.isInteger(s.winner) &&
        s.winner >= -1 &&
        s.winner < s.hands.length)
    ) ||
    !Number.isInteger(s.turn) ||
    s.turn < 1 ||
    !Number.isInteger(s.passes) ||
    s.passes < 0 ||
    s.passes > s.hands.length ||
    (s.passes === s.hands.length && !(allowFinished && s.winner !== null)) ||
    (s.discard.at(-1)?.color !== 'wild' &&
      s.color !== s.discard.at(-1)?.color) ||
    !(
      s.challenge == null ||
      (Number.isInteger(s.challenge.offender) &&
        s.challenge.offender >= 0 &&
        s.challenge.offender < s.hands.length &&
        s.challenge.offender !== s.current &&
        typeof s.challenge.illegal === 'boolean')
    ) ||
    !(
      s.unoPending == null ||
      (Number.isInteger(s.unoPending) &&
        s.unoPending >= 0 &&
        s.unoPending < s.hands.length &&
        s.hands[s.unoPending].length === 1)
    ) ||
    !(
      s.unoDeclared == null ||
      (Number.isInteger(s.unoDeclared) &&
        s.unoDeclared === s.current &&
        s.hands[s.unoDeclared].length === 2)
    ) ||
    !(
      s.drawnId === null ||
      (Number.isInteger(s.drawnId) &&
        s.hands[s.current].some((card) => card?.id === s.drawnId))
    )
  )
    return false;
  const cards = [...s.stock, ...s.discard, ...s.hands.flat()];
  const reference = unoDeck(s.hands.length);
  return (
    cards.length === reference.length &&
    cards.every(
      (card) =>
        card &&
        Number.isInteger(card.id) &&
        card.id >= 0 &&
        card.id < reference.length &&
        card.color === reference[card.id].color &&
        card.value === reference[card.id].value,
    ) &&
    new Set(cards.map((card) => card.id)).size === reference.length
  );
}

export function unoView(state: UnoState, player: number) {
  return {
    hand: state.hands[player].map((card) => ({ ...card })),
    counts: state.hands.map((hand) => hand.length),
    top: { ...state.discard.at(-1)! },
    color: state.color,
    current: state.current,
    direction: state.direction,
    drawnId: player === state.current ? state.drawnId : null,
    stockCount: state.stock.length,
    canDraw: !!(state.stock.length || state.discard.length > 1),
    canPass:
      !state.challenge &&
      player === state.current &&
      (state.drawnId !== null ||
        (!(state.stock.length || state.discard.length > 1) &&
          !state.hands[state.current].some((card) => canPlayUno(state, card)))),
    challenge: !!state.challenge,
    unoPending: state.unoPending,
    unoDeclared: state.unoDeclared === player,
    turn: state.turn,
    winner: state.winner,
  };
}

export type CardGameId = 'crazy-eights' | 'uno';
export type CardState =
  | { gameId: 'crazy-eights'; state: EightState }
  | { gameId: 'uno'; state: UnoState };
export const wrapCards = (
  gameId: CardGameId,
  state: EightState | UnoState,
): CardState => ({ gameId, state }) as CardState;
export function newCards(
  gameId: CardGameId,
  count = 2,
  random: Random = Math.random,
): CardState {
  return gameId === 'crazy-eights'
    ? { gameId, state: newCrazyEightsGame(random) }
    : { gameId, state: newUnoGame(count, random) };
}
export function validCardState(
  value: unknown,
  finished = false,
): value is CardState {
  if (!value || typeof value !== 'object') return false;
  const s = value as CardState;
  return (
    Object.keys(s).length === 2 &&
    (s.gameId === 'crazy-eights'
      ? validCrazyEightsCheckpoint(s.state, finished)
      : s.gameId === 'uno' && validUnoCheckpoint(s.state, finished))
  );
}
export function finishedCards(s: CardState) {
  return s.gameId === 'crazy-eights'
    ? s.state.phase === 'over'
    : s.state.winner !== null;
}
export const eightId = (c: Card) => `${c.suit}:${c.rank}`;
export function applyCards(
  value: CardState,
  input: unknown,
  actor: number,
  random: Random = Math.random,
): CardState | null {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    finishedCards(value)
  )
    return null;
  const action = input as Record<string, unknown>;
  const keys: Record<string, string[]> =
    value.gameId === 'crazy-eights'
      ? {
          play: ['type', 'id'],
          draw: ['type'],
          pass: ['type'],
          choose: ['type', 'suit'],
        }
      : {
          play:
            action.color === undefined
              ? ['type', 'id']
              : ['type', 'id', 'color'],
          draw: ['type'],
          pass: ['type'],
          uno: ['type'],
          catch: ['type'],
          accept: ['type'],
          challenge: ['type'],
        };
  const expected = typeof action.type === 'string' ? keys[action.type] : null;
  if (
    !expected ||
    Object.keys(action).length !== expected.length ||
    !expected.every((k) => Object.hasOwn(action, k))
  )
    return null;
  const next = structuredClone(value);
  if (next.gameId === 'crazy-eights') {
    if (actor !== next.state.current) return null;
    if (next.state.phase === 'handoff') next.state.phase = 'play';
    return actCrazyEights(next.state, input as EightAction, random)
      ? next
      : null;
  }
  if (
    action.type === 'play' &&
    (!Number.isInteger(action.id) ||
      (action.color !== undefined &&
        !COLORS.includes(action.color as UnoCard['color'])))
  )
    return null;
  return actUno(next.state, input as UnoAction, random, actor) ? next : null;
}
export interface CardView {
  gameId: CardGameId;
  seat: number;
  hand: string[];
  counts: number[];
  top: string;
  active: string;
  current: number;
  phase: 'play' | 'choose' | 'over';
  legal: string[];
  canDraw: boolean;
  canPass: boolean;
  stockCount: number;
  turn: number;
  winner: number | null;
  ending: string;
  scores: number[] | null;
  drawn: boolean;
  direction: number;
  challenge: boolean;
  unoPending: number | null;
  unoDeclared: boolean;
}
export function cardView(s: CardState, seat: number): CardView {
  if (s.gameId === 'crazy-eights') {
    const v = crazyEightsView(s.state, seat);
    return {
      gameId: s.gameId,
      seat,
      hand: v.hand.map(eightId),
      counts: v.counts,
      top: eightId(v.top),
      active: v.activeSuit,
      current: v.current,
      phase: (v.phase === 'handoff' ? 'play' : v.phase) as CardView['phase'],
      legal:
        seat === v.current && v.phase !== 'over' && v.phase !== 'choose'
          ? v.hand.filter((c) => canPlay(c, v.top, v.activeSuit)).map(eightId)
          : [],
      canDraw: v.canDraw,
      canPass: v.canPass,
      stockCount: v.stockCount,
      turn: v.turn,
      winner: v.winner,
      ending: v.ending,
      scores: v.scores,
      drawn: v.drawn,
      direction: 1,
      challenge: false,
      unoPending: null,
      unoDeclared: false,
    };
  }
  const v = unoView(s.state, seat);
  return {
    gameId: s.gameId,
    seat,
    hand: v.hand.map((c) => String(c.id)),
    counts: v.counts,
    top: String(v.top.id),
    active: v.color,
    current: v.current,
    phase: v.winner !== null ? 'over' : 'play',
    legal: v.hand
      .filter((c) => canPlayUno(s.state, c, seat))
      .map((c) => String(c.id)),
    canDraw: v.canDraw,
    canPass: v.canPass,
    stockCount: v.stockCount,
    turn: v.turn,
    winner: v.winner,
    ending: v.winner !== null ? 'empty' : '',
    scores: null,
    drawn: v.drawnId !== null,
    direction: v.direction,
    challenge: v.challenge,
    unoPending: v.unoPending,
    unoDeclared: v.unoDeclared,
  };
}
const VIEW_KEYS = [
  'gameId',
  'seat',
  'hand',
  'counts',
  'top',
  'active',
  'current',
  'phase',
  'legal',
  'canDraw',
  'canPass',
  'stockCount',
  'turn',
  'winner',
  'ending',
  'scores',
  'drawn',
  'direction',
  'challenge',
  'unoPending',
  'unoDeclared',
];
/** Reject unknown fields as well as malformed projections: a host's private deck must never be accepted by a guest. */
export function validCardView(
  value: unknown,
  count: number,
  seat: number,
): value is CardView {
  if (!value || typeof value !== 'object') return false;
  const v = value as CardView;
  const integer = (n: unknown): n is number =>
    Number.isSafeInteger(n) && (n as number) >= 0;
  if (
    Object.keys(v).length !== VIEW_KEYS.length ||
    !VIEW_KEYS.every((k) => Object.hasOwn(v, k)) ||
    !['crazy-eights', 'uno'].includes(v.gameId) ||
    count < 2 ||
    count > (v.gameId === 'crazy-eights' ? 2 : 20) ||
    v.seat !== seat ||
    !integer(seat) ||
    seat >= count ||
    !Array.isArray(v.hand) ||
    !Array.isArray(v.counts) ||
    v.counts.length !== count ||
    !v.counts.every(integer) ||
    v.hand.length !== v.counts[seat] ||
    !integer(v.current) ||
    v.current >= count ||
    !['play', 'choose', 'over'].includes(v.phase) ||
    !Array.isArray(v.legal) ||
    !v.legal.every((id) => v.hand.includes(id)) ||
    new Set(v.legal).size !== v.legal.length ||
    !integer(v.stockCount) ||
    !integer(v.turn) ||
    v.turn < 1 ||
    ![1, -1].includes(v.direction) ||
    !['canDraw', 'canPass', 'drawn', 'challenge', 'unoDeclared'].every(
      (k) => typeof v[k as 'canDraw'] === 'boolean',
    ) ||
    !(
      v.winner === null ||
      (Number.isInteger(v.winner) && v.winner >= -1 && v.winner < count)
    ) ||
    !(
      v.unoPending === null ||
      (integer(v.unoPending) && v.unoPending < count)
    ) ||
    !(
      v.scores === null ||
      (Array.isArray(v.scores) &&
        v.scores.length === count &&
        v.scores.every(integer))
    ) ||
    !['', 'empty', 'blocked'].includes(v.ending)
  )
    return false;
  const ids =
    v.gameId === 'crazy-eights'
      ? eightDeck(() => 0.5).map(eightId)
      : unoDeck(count).map((c) => String(c.id));
  return (
    [...v.hand, v.top].every(
      (id) => typeof id === 'string' && ids.includes(id),
    ) &&
    new Set([...v.hand, v.top]).size === v.hand.length + 1 &&
    v.counts.reduce((a, b) => a + b, 0) + v.stockCount + 1 <= ids.length &&
    (v.gameId === 'crazy-eights'
      ? SUITS.includes(v.active as Card['suit'])
      : COLORS.includes(v.active as UnoCard['color'])) &&
    (seat === v.current ||
      (v.legal.length === 0 && v.phase !== 'choose' && !v.canPass)) &&
    !(v.phase === 'over' && v.legal.length) &&
    !(v.phase !== 'over' && v.winner !== null)
  );
}
export function displayCard(gameId: CardGameId, id: string) {
  if (gameId === 'crazy-eights') {
    const [suit, rank] = id.split(':') as [Card['suit'], Card['rank']];
    const names = {
      '♠': 'spades',
      '♥': 'hearts',
      '♦': 'diamonds',
      '♣': 'clubs',
    };
    return {
      label: `${rank} of ${names[suit]}`,
      mark: rank,
      detail: suit,
      tone: suit === '♥' || suit === '♦' ? 'red' : 'cream',
      wild: rank === '8',
    };
  }
  const c = unoDeck(20)[Number(id)];
  const marks: Record<string, string> = {
    skip: '⊘',
    reverse: '↶',
    draw2: '+2',
    wild: '★',
    wild4: '+4',
  };
  return {
    label: `${c.color} ${c.value}`,
    mark: marks[c.value] ?? c.value,
    detail: c.color,
    tone: c.color,
    wild: c.color === 'wild',
  };
}
