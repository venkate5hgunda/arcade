import { shuffle } from './puzzles.ts';
import type { Random } from './puzzles.ts';
export const SUITS = ['♠', '♥', '♦', '♣'] as const;
export const RANKS = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
] as const;
export interface Card {
  suit: (typeof SUITS)[number];
  rank: (typeof RANKS)[number];
}
export interface BlackjackState {
  deck: Card[];
  dealer: Card[];
  player: Card[];
  result: 'win' | 'loss' | 'push' | null;
  doubled: boolean;
  round: number;
  record: { wins: number; losses: number; pushes: number; net: number };
  message: string;
}
export function shuffledDeck(random: Random = Math.random): Card[] {
  return shuffle(
    SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank }))),
    random,
  );
}
export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0,
    aces = 0;
  for (const { rank } of cards) {
    if (rank === 'A') {
      total += 11;
      aces++;
    } else total += ['J', 'Q', 'K'].includes(rank) ? 10 : Number(rank);
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}
function finish(
  s: BlackjackState,
  result: NonNullable<BlackjackState['result']>,
  message: string,
): BlackjackState {
  s.result = result;
  s.message = message;
  if (result === 'win') {
    s.record.wins++;
    s.record.net +=
      s.player.length === 2 && handValue(s.player).total === 21 && !s.doubled
        ? 1.5
        : s.doubled
          ? 2
          : 1;
  } else if (result === 'loss') {
    s.record.losses++;
    s.record.net -= s.doubled ? 2 : 1;
  } else s.record.pushes++;
  return s;
}
function draw(deck: Card[], hand: Card[]) {
  const card = deck.pop();
  if (!card) throw new RangeError('The deck cannot supply another card.');
  hand.push(card);
}
function settle(s: BlackjackState): BlackjackState {
  while (handValue(s.dealer).total < 17) draw(s.deck, s.dealer);
  const d = handValue(s.dealer).total,
    p = handValue(s.player).total;
  return d > 21
    ? finish(s, 'win', `Dealer busts with ${d}. You win!`)
    : p > d
      ? finish(s, 'win', `${p} beats ${d}. You win!`)
      : p < d
        ? finish(s, 'loss', `Dealer’s ${d} beats your ${p}.`)
        : finish(s, 'push', `${p} to ${d}. Push — stakes returned.`);
}
export function newBlackjack(
  previous?: BlackjackState | null,
  random: Random = Math.random,
): BlackjackState {
  const s: BlackjackState = {
    deck: shuffledDeck(random),
    dealer: [],
    player: [],
    result: null,
    doubled: false,
    round: (previous?.round ?? 0) + 1,
    record: previous
      ? { ...previous.record }
      : { wins: 0, losses: 0, pushes: 0, net: 0 },
    message: 'Your move: hit, stand, or double down.',
  };
  draw(s.deck, s.player);
  draw(s.deck, s.dealer);
  draw(s.deck, s.player);
  draw(s.deck, s.dealer);
  const p = handValue(s.player).total === 21,
    d = handValue(s.dealer).total === 21;
  return p && d
    ? finish(s, 'push', 'Both have blackjack. Push!')
    : p
      ? finish(s, 'win', 'Natural blackjack! You win 3:2.')
      : d
        ? finish(s, 'loss', 'Dealer has blackjack.')
        : s;
}
export function actBlackjack(
  state: BlackjackState,
  action: 'hit' | 'stand' | 'double',
): BlackjackState {
  if (
    state.result !== null ||
    !['hit', 'stand', 'double'].includes(action) ||
    (action === 'double' && state.player.length !== 2)
  )
    return state;
  const s = structuredClone(state);
  if (action === 'stand') return settle(s);
  if (action === 'double') s.doubled = true;
  draw(s.deck, s.player);
  const score = handValue(s.player).total;
  if (score > 21) return finish(s, 'loss', `Bust at ${score}. Dealer wins.`);
  if (action === 'double' || score === 21) return settle(s);
  s.message = `You have ${score}. Hit or stand?`;
  return s;
}
export function validBlackjack(value: unknown): value is BlackjackState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as BlackjackState;
  if (
    !Array.isArray(s.deck) ||
    !Array.isArray(s.dealer) ||
    s.dealer.length !== 2 ||
    !Array.isArray(s.player) ||
    s.player.length < 2 ||
    s.player.length > 11 ||
    s.result !== null ||
    s.doubled !== false ||
    !Number.isSafeInteger(s.round) ||
    s.round < 1 ||
    !s.record ||
    typeof s.record !== 'object' ||
    !['wins', 'losses', 'pushes'].every(
      (k) =>
        Number.isSafeInteger(s.record[k as 'wins']) &&
        s.record[k as 'wins'] >= 0,
    ) ||
    !Number.isFinite(s.record.net) ||
    s.record.wins + s.record.losses + s.record.pushes > s.round - 1 ||
    typeof s.message !== 'string' ||
    s.message.length > 160
  )
    return false;
  const cards = [...s.deck, ...s.dealer, ...s.player];
  return (
    cards.length === 52 &&
    cards.every(
      (c) =>
        c &&
        typeof c === 'object' &&
        SUITS.includes(c.suit) &&
        RANKS.includes(c.rank),
    ) &&
    new Set(cards.map((c) => `${c.suit}:${c.rank}`)).size === 52 &&
    handValue(s.player).total < 21 &&
    handValue(s.dealer).total !== 21
  );
}
