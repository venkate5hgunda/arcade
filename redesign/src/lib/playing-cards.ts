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
export function shuffledDeck(random: Random = Math.random): Card[] {
  return shuffle(
    SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank }))),
    random,
  );
}
