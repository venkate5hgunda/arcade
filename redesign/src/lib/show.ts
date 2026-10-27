import { shuffle } from './puzzles.ts';
import type { Random } from './puzzles.ts';
export const SYMBOLS = [
  '★ Star',
  '☀ Sun',
  '☾ Moon',
  '♣ Clover',
  '◆ Diamond',
  '♥ Heart',
  '✿ Flower',
  '⚡ Bolt',
];
export interface ShowState {
  players: number;
  rounds: number;
  round: number;
  scores: number[];
  hands: number[][];
  picks: number[];
  phase: 'passing' | 'slapping' | 'scored';
  stack: number[];
}
export function deal(players: number, random: Random = Math.random) {
  const deck = shuffle(
    Array.from({ length: players * 4 }, (_, i) => Math.floor(i / 4)),
    random,
  );
  return Array.from({ length: players }, (_, i) =>
    deck.slice(i * 4, i * 4 + 4),
  );
}
export const matches = (hand: number[]) =>
  hand.length === 4 && hand.every((chit) => chit === hand[0]);
export function passChits(hands: number[][], picks: number[]) {
  return hands.map((hand, i) => [
    ...hand.filter((_, j) => j !== picks[i]),
    hands[(i + hands.length - 1) % hands.length][
      picks[(i + hands.length - 1) % hands.length]
    ],
  ]);
}
export const stackPoints = (stack: number[], players: number) =>
  Array.from({ length: players }, (_, i) =>
    stack.includes(i) ? players - stack.indexOf(i) : 0,
  );
export function validShow(value: unknown): value is ShowState {
  const s = value as ShowState;
  if (
    !s ||
    !Number.isInteger(s.players) ||
    s.players < 3 ||
    s.players > 8 ||
    ![3, 5, 10].includes(s.rounds) ||
    !Number.isInteger(s.round) ||
    s.round < 1 ||
    s.round > s.rounds ||
    !Array.isArray(s.scores) ||
    s.scores.length !== s.players ||
    !s.scores.every(
      (n) => Number.isInteger(n) && n >= 0 && n <= s.players * s.rounds,
    ) ||
    !Array.isArray(s.hands) ||
    s.hands.length !== s.players ||
    !s.hands.every(
      (h) =>
        Array.isArray(h) &&
        h.length === 4 &&
        h.every((c) => Number.isInteger(c) && c >= 0 && c < s.players),
    ) ||
    !Array.isArray(s.picks) ||
    s.picks.length >= s.players ||
    !s.picks.every((n) => Number.isInteger(n) && n >= 0 && n < 4) ||
    !['passing', 'slapping', 'scored'].includes(s.phase) ||
    !Array.isArray(s.stack) ||
    new Set(s.stack).size !== s.stack.length ||
    !s.stack.every((n) => Number.isInteger(n) && n >= 0 && n < s.players)
  )
    return false;
  if (
    !Array.from(
      { length: s.players },
      (_, i) => s.hands.flat().filter((c) => c === i).length === 4,
    ).every(Boolean)
  )
    return false;
  return s.phase === 'passing'
    ? s.stack.length === 0
    : s.stack.length > 0 &&
        s.stack[0] === s.picks.length &&
        matches(s.hands[s.stack[0]]) &&
        (s.phase === 'scored'
          ? s.stack.length === s.players
          : s.stack.length < s.players);
}
export function newShow(
  players: number,
  rounds: number,
  scores = Array(players).fill(0),
  round = 1,
): ShowState {
  if (
    !Number.isInteger(players) ||
    players < 3 ||
    players > 8 ||
    ![3, 5, 10].includes(rounds)
  )
    throw new RangeError('Choose 3–8 players and 3, 5 or 10 rounds.');
  return {
    players,
    rounds,
    round,
    scores,
    hands: deal(players),
    picks: [],
    phase: 'passing',
    stack: [],
  };
}
