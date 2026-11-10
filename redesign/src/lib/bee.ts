import { WORD_BANK } from '../data/word-bank.ts';
import { edition, object, unique, validEdition } from './daily.ts';
export interface BeeState {
  gameId: 'spelling-bee';
  seed: number;
  date: string | null;
  words: string[];
}
export const HIVES = [
  ['READING', 'R'],
  ['PAINTER', 'P'],
  ['HEATING', 'H'],
  ['COASTED', 'C'],
  ['PLANETS', 'L'],
  ['ORANGES', 'R'],
  ['FLOWERS', 'F'],
  ['STORAGE', 'G'],
  ['MASTERY', 'A'],
];
export function beePuzzle(seed: number) {
  const [letters, center] = HIVES[seed % HIVES.length];
  const words = WORD_BANK.filter(
    (word) =>
      word.length >= 4 &&
      word.includes(center) &&
      [...word].every((c) => letters.includes(c)),
  );
  return { letters, center, words };
}
export function beeScore(word: string) {
  return (
    (word.length === 4 ? 1 : word.length) + (new Set(word).size === 7 ? 7 : 0)
  );
}
export function beeProgress(s: BeeState) {
  const puzzle = beePuzzle(s.seed),
    score = s.words.reduce((n, word) => n + beeScore(word), 0),
    max = puzzle.words.reduce((n, word) => n + beeScore(word), 0),
    ratio = score / max;
  const rank =
    ratio === 1
      ? 'Queen Bee'
      : ratio >= 0.7
        ? 'Genius'
        : ratio >= 0.4
          ? 'Great'
          : ratio >= 0.15
            ? 'Moving up'
            : score
              ? 'Good start'
              : 'Beginner';
  return { score, max, rank, done: s.words.length === puzzle.words.length };
}
export const newBee = (mode = 'daily'): BeeState => ({
  gameId: 'spelling-bee',
  ...edition(mode),
  words: [],
});
export function actBee(
  s: BeeState,
  input: unknown,
): { state: BeeState; message: string } {
  const fail = (message: string) => ({ state: s, message });
  if (
    !object(input) ||
    input.type !== 'word' ||
    typeof input.word !== 'string' ||
    input.word.length > 40 ||
    beeProgress(s).done
  )
    return fail('Enter a word to continue.');
  const word = input.word.trim().toUpperCase(),
    puzzle = beePuzzle(s.seed);
  if (word.length < 4) return fail('Use at least four letters.');
  if (!word.includes(puzzle.center))
    return fail(`Every word needs ${puzzle.center}.`);
  if (![...word].every((c) => puzzle.letters.includes(c)))
    return fail('Use only the seven hive letters.');
  if (!puzzle.words.includes(word))
    return fail('That word is outside this bundled word list.');
  if (s.words.includes(word))
    return fail('Already found. It will not score twice.');
  return {
    state: { ...s, words: [...s.words, word] },
    message:
      new Set(word).size === 7
        ? `Pangram! +${beeScore(word)}`
        : `+${beeScore(word)} points`,
  };
}
export function validBee(
  value: unknown,
  allowFinished = false,
): value is BeeState {
  if (!object(value)) return false;
  const s = value as unknown as BeeState;
  if (
    Object.keys(s).sort().join() !== 'date,gameId,seed,words' ||
    s.gameId !== 'spelling-bee' ||
    !validEdition(s) ||
    !Array.isArray(s.words) ||
    s.words.length > 2048 ||
    !unique(s.words)
  )
    return false;
  const puzzle = beePuzzle(s.seed);
  return (
    s.words.every(
      (word) => typeof word === 'string' && puzzle.words.includes(word),
    ) &&
    (allowFinished || !beeProgress(s).done)
  );
}
export const beeDone = (s: BeeState) => beeProgress(s).done;
