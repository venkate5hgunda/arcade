import {
  edition,
  int,
  object,
  randomFor,
  shuffle,
  unique,
  validEdition,
} from './daily.ts';
export interface StrandsState {
  gameId: 'strands';
  seed: number;
  date: string | null;
  found: { word: number; path: number[] }[];
  hints: number[];
}
export const STRANDS_SETS = [
  {
    theme: 'Out in the garden',
    span: 'GARDEN',
    words: 'FLOWERS SEED WATER SOIL LEAF ROOT STEM PETAL BLOOM',
  },
  {
    theme: 'In the kitchen cupboard',
    span: 'PANTRY',
    words: 'FLOUR SUGAR SPICE PASTA RICE SALT BEANS OIL JAM TEA',
  },
  {
    theme: 'Make some music',
    span: 'MELODY',
    words: 'PIANO GUITAR DRUM FLUTE CELLO VIOLIN OBOE HARP BOW',
  },
  {
    theme: 'A day by the water',
    span: 'COASTS',
    words: 'SAND SHELL WAVES TIDE SHORE DUNE BEACH OCEAN GULLS',
  },
  {
    theme: 'Look up at night',
    span: 'COSMOS',
    words: 'SOLAR MOON EARTH VENUS MARS COMET ORBIT STAR PLUTO',
  },
  {
    theme: 'Time to play',
    span: 'SPORTS',
    words: 'BALL BAT GOAL RACE TEAM COURT NET PITCH FIELD TRACK',
  },
  {
    theme: 'Going places',
    span: 'VOYAGE',
    words: 'TRAIN PLANE SHIP CAR BUS TAXI BIKE ROAD MAP TRIP BAG',
  },
  {
    theme: 'Paint the shelf',
    span: 'COLORS',
    words: 'CORAL TEAL GOLD NAVY CREAM PINK BLUE RED GREEN LIME',
  },
];
export function strandsPuzzle(seed: number) {
  const set = STRANDS_SETS[seed % STRANDS_SETS.length],
    random = randomFor(seed);
  const words = [set.span, ...shuffle(set.words.split(' '), random)];
  const route = Array.from({ length: 48 }, (_, i) => {
    const row = Math.floor(i / 6),
      col = row % 2 ? 5 - (i % 6) : i % 6;
    return (seed % 2 ? 7 - row : row) * 6 + (seed % 3 ? col : 5 - col);
  });
  const letters = Array<string>(48),
    paths: number[][] = [];
  let offset = 0;
  for (const word of words) {
    const path = route.slice(offset, offset + word.length);
    paths.push(path);
    path.forEach((cell, i) => (letters[cell] = word[i]));
    offset += word.length;
  }
  return { theme: set.theme, words, letters, paths };
}
export const newStrands = (mode = 'daily'): StrandsState => ({
  gameId: 'strands',
  ...edition(mode),
  found: [],
  hints: [],
});
export const strandsDone = (s: StrandsState) =>
  s.found.length === strandsPuzzle(s.seed).words.length;
export function actStrands(
  s: StrandsState,
  input: unknown,
): { state: StrandsState; message: string } {
  const fail = (message: string) => ({ state: s, message });
  if (strandsDone(s) || !object(input)) return fail('This puzzle is finished.');
  if (input.type === 'hint') {
    const word = strandsPuzzle(s.seed).words.findIndex(
      (_, i) => !s.found.some((f) => f.word === i) && !s.hints.includes(i),
    );
    return s.hints.length < 3 && word >= 0
      ? {
          state: { ...s, hints: [...s.hints, word] },
          message: 'The start of an unfound theme word is highlighted.',
        }
      : fail('No more hints are available.');
  }
  const path = input.path,
    puzzle = strandsPuzzle(s.seed);
  if (
    input.type !== 'word' ||
    !Array.isArray(path) ||
    path.length < 3 ||
    path.length > 48 ||
    !path.every((n) => int(n, 0, 47)) ||
    !unique(path)
  )
    return fail('Trace at least three different adjacent letters.');
  if (
    path.some(
      (n, i) =>
        i > 0 &&
        (Math.abs(Math.floor(n / 6) - Math.floor(path[i - 1] / 6)) > 1 ||
          Math.abs((n % 6) - (path[i - 1] % 6)) > 1),
    )
  )
    return fail('Letters must touch, including diagonally.');
  if (path.some((n) => s.found.some((f) => f.path.includes(n))))
    return fail('Those letters already belong to a found word.');
  const text = path.map((n) => puzzle.letters[n]).join(''),
    word = puzzle.words.indexOf(text);
  if (word < 0) return fail('That is not one of this puzzle’s theme words.');
  if (s.found.some((f) => f.word === word)) return fail('Already found.');
  return {
    state: { ...s, found: [...s.found, { word, path: [...path] }] },
    message: word === 0 ? 'Spangram found!' : `${text} found!`,
  };
}
export function validStrands(
  value: unknown,
  allowFinished = false,
): value is StrandsState {
  if (!object(value)) return false;
  const s = value as unknown as StrandsState;
  if (
    Object.keys(s).sort().join() !== 'date,found,gameId,hints,seed' ||
    s.gameId !== 'strands' ||
    !validEdition(s) ||
    !Array.isArray(s.hints) ||
    s.hints.length > 3 ||
    !unique(s.hints) ||
    !s.hints.every((n) => int(n, 0, strandsPuzzle(s.seed).words.length - 1)) ||
    !Array.isArray(s.found) ||
    s.found.length > 12
  )
    return false;
  let replay: StrandsState = { ...s, found: [] };
  for (const found of s.found) {
    if (!object(found) || Object.keys(found).sort().join() !== 'path,word')
      return false;
    const next = actStrands(replay, { type: 'word', path: found.path }).state;
    if (next === replay || next.found.at(-1)?.word !== found.word) return false;
    replay = next;
  }
  return allowFinished || !strandsDone(s);
}
