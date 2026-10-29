import { shuffle } from './puzzles.ts';
import type { Random } from './puzzles.ts';
export const SCRAMBLE_WORDS = [
  'ARCADE',
  'PUZZLE',
  'PLAYER',
  'VICTORY',
  'CHAMPION',
  'STRATEGY',
  'REFLEX',
  'JOYSTICK',
  'CONTROLLER',
  'PIXEL',
  'LEVEL',
  'BONUS',
  'COMBO',
  'RETRO',
  'GALAXY',
  'ROCKET',
  'DRAGON',
  'CASTLE',
  'TREASURE',
  'ADVENTURE',
  'MYSTERY',
  'RAINBOW',
  'THUNDER',
  'CRYSTAL',
  'PHOENIX',
  'WIZARD',
  'KNIGHT',
  'JUNGLE',
  'VOLCANO',
  'GLACIER',
  'METEOR',
  'COMET',
  'NEBULA',
  'ORBIT',
  'COSMIC',
];
export interface ScrambleState {
  rounds: string;
  pool: string[];
  word: string;
  letters: string[];
  round: number;
  correctCount: number;
  hintsUsed: number;
  hinted: boolean;
  solved: boolean;
}
export function validScramble(value: unknown): value is ScrambleState {
  const s = value as ScrambleState;
  return (
    !!s &&
    typeof s === 'object' &&
    !Array.isArray(s) &&
    ['5', '8', '12'].includes(s.rounds) &&
    Number.isInteger(s.round) &&
    s.round >= 1 &&
    s.round <= Number(s.rounds) &&
    Number.isInteger(s.correctCount) &&
    s.correctCount >= 0 &&
    s.correctCount <= s.round &&
    Number.isInteger(s.hintsUsed) &&
    s.hintsUsed >= 0 &&
    typeof s.hinted === 'boolean' &&
    typeof s.solved === 'boolean' &&
    (!s.solved || s.correctCount > 0) &&
    SCRAMBLE_WORDS.includes(s.word) &&
    Array.isArray(s.pool) &&
    s.pool.every((w) => SCRAMBLE_WORDS.includes(w)) &&
    new Set(s.pool).size === s.pool.length &&
    !s.pool.includes(s.word) &&
    Array.isArray(s.letters) &&
    s.letters.length === s.word.length &&
    s.letters.every((l) => typeof l === 'string' && /^[A-Z]$/.test(l)) &&
    s.letters.slice().sort().join('') === s.word.split('').sort().join('')
  );
}
function pick(pool: string[], random: Random) {
  const remaining = pool.length
    ? pool.slice()
    : shuffle(SCRAMBLE_WORDS, random);
  const word = remaining.pop()!;
  let letters = shuffle([...word], random);
  if (letters.join('') === word) {
    const index = letters.findIndex((ch) => ch !== letters[0]);
    if (index > 0) [letters[0], letters[index]] = [letters[index], letters[0]];
  }
  return { pool: remaining, word, letters };
}
export function newScramble(
  rounds: string,
  random: Random = Math.random,
): ScrambleState {
  if (!['5', '8', '12'].includes(rounds))
    throw new RangeError('Choose 5, 8 or 12 rounds.');
  return {
    rounds,
    ...pick([], random),
    round: 1,
    correctCount: 0,
    hintsUsed: 0,
    hinted: false,
    solved: false,
  };
}
export function nextScramble(
  s: ScrambleState,
  random: Random = Math.random,
): ScrambleState {
  return {
    ...s,
    ...(s.round < Number(s.rounds) ? pick(s.pool, random) : {}),
    round: s.round + 1,
    hinted: false,
    solved: false,
  };
}
