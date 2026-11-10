import { LETTER_LAYOUTS } from '../data/letter-boxed.ts';
import { WORD_BANK } from '../data/word-bank.ts';
import { edition, object, unique, validEdition } from './daily.ts';
export interface LetterState {
  gameId: 'letter-boxed';
  seed: number;
  date: string | null;
  words: string[];
}
const dictionary = new Set(WORD_BANK);
export function letterPuzzle(seed: number) {
  const base = LETTER_LAYOUTS[seed % LETTER_LAYOUTS.length];
  return {
    ...base,
    sides: base.sides.map(
      (_, i) =>
        base.sides[(i + (Math.floor(seed / LETTER_LAYOUTS.length) % 4)) % 4],
    ),
  };
}
export const newLetter = (mode = 'daily'): LetterState => ({
  gameId: 'letter-boxed',
  ...edition(mode),
  words: [],
});
export const letterUsed = (s: LetterState) => new Set(s.words.join(''));
export const letterDone = (s: LetterState) => letterUsed(s).size === 12;
export function actLetter(
  s: LetterState,
  input: unknown,
): { state: LetterState; message: string } {
  const fail = (message: string) => ({ state: s, message });
  if (letterDone(s) || !object(input)) return fail('This puzzle is complete.');
  if (input.type === 'undo')
    return s.words.length
      ? {
          state: { ...s, words: s.words.slice(0, -1) },
          message: 'Last word removed.',
        }
      : fail('No words to undo.');
  if (
    input.type !== 'word' ||
    typeof input.word !== 'string' ||
    input.word.length > 40
  )
    return fail('Enter a word.');
  const word = input.word.trim().toUpperCase(),
    puzzle = letterPuzzle(s.seed),
    last = s.words.at(-1)?.at(-1);
  if (word.length < 3) return fail('Use at least three letters.');
  if (s.words.length >= 64) return fail('Undo a word to shorten your chain.');
  if (last && word[0] !== last)
    return fail(`Start the next word with ${last}.`);
  if ([...word].some((c) => !puzzle.sides.some((side) => side.includes(c))))
    return fail('Use only the letters around the square.');
  if (
    [...word].some(
      (c, i) =>
        i > 0 &&
        puzzle.sides.findIndex((side) => side.includes(c)) ===
          puzzle.sides.findIndex((side) => side.includes(word[i - 1])),
    )
  )
    return fail('Consecutive letters must come from different sides.');
  if (!dictionary.has(word))
    return fail('That word is outside the bundled word list.');
  if (s.words.includes(word))
    return fail('That word is already in your chain.');
  const next = { ...s, words: [...s.words, word] };
  return {
    state: next,
    message: letterDone(next)
      ? 'All twelve letters covered!'
      : `${letterUsed(next).size} of 12 letters covered.`,
  };
}
export function validLetter(
  value: unknown,
  allowFinished = false,
): value is LetterState {
  if (!object(value)) return false;
  const s = value as unknown as LetterState;
  if (
    Object.keys(s).sort().join() !== 'date,gameId,seed,words' ||
    s.gameId !== 'letter-boxed' ||
    !validEdition(s) ||
    !Array.isArray(s.words) ||
    s.words.length > 64 ||
    !unique(s.words)
  )
    return false;
  let replay: LetterState = { ...s, words: [] };
  for (const word of s.words) {
    const next = actLetter(replay, { type: 'word', word }).state;
    if (next === replay) return false;
    replay = next;
  }
  return allowFinished || !letterDone(s);
}
