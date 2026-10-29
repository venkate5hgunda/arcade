import { filterMovies, uniqueMovies } from './movies.ts';
import type { Movie, MovieFilters } from './movies.ts';
export const CHARADES_WORDS = [
  'MOVIE',
  'BRUSH TEETH',
  'ELEPHANT',
  'SWIMMING',
  'COOKING',
  'DRIVING',
  'SLEEPING',
  'DANCING',
  'SINGING',
  'READING',
  'PAINTING',
  'FISHING',
  'CAMPING',
  'SKIING',
  'SURFING',
  'CLIMBING',
  'RUNNING',
  'JUMPING',
  'FLYING KITE',
  'WALKING DOG',
  'WASHING CAR',
  'MOWING LAWN',
  'SHOPPING',
  'SUPERMAN',
  'SPIDERMAN',
  'BATMAN',
  'HARRY POTTER',
  'FROZEN',
  'TOY STORY',
  'TITANIC',
  'AVATAR',
  'JAWS',
  'STAR WARS',
  'INDIANA JONES',
  'ROCKY',
  'GHOSTBUSTERS',
  'BACK TO THE FUTURE',
  'ETERNAL SUNSHINE',
  'INCEPTION',
  'LION KING',
  'ALADDIN',
  'BEAUTY BEAST',
  'CINDERELLA',
  'SNOW WHITE',
  'EATING SPAGHETTI',
  'BLOWING CANDLES',
  'OPENING PRESENT',
  'WRAPPING GIFT',
  'BUILDING SNOWMAN',
  'MAKING SNOW ANGEL',
  'ROASTING MARSHMALLOW',
  'PLAYING PIANO',
  'PLAYING GUITAR',
  'PLAYING DRUMS',
  'PLAYING VIOLIN',
  'ACTING',
  'DIRECTING',
  'FILMING',
  'EDITING',
  'WRITING SCRIPT',
];
export interface CharadesState extends MovieFilters {
  players: number;
  duration: number;
  category: 'classic' | 'telugu-movies';
  phase: 'setup' | 'acting' | 'scoring' | 'gameover';
  team: 0 | 1;
  actor: number;
  score: [number, number];
  word: string;
  wordsUsed: string[];
  guessedCorrect: boolean;
  deadline: number;
}
export function charadesPrompts(
  category: CharadesState['category'],
  movies: Movie[],
  filters: MovieFilters,
): string[] {
  return category === 'classic'
    ? CHARADES_WORDS
    : uniqueMovies(filterMovies(movies, filters)).map((movie) => movie.prompt);
}
export function validCharades(
  value: unknown,
  movies?: Movie[],
): value is CharadesState {
  const s = value as CharadesState;
  if (
    !s ||
    ![2, 4, 6, 8].includes(s.players) ||
    !Number.isInteger(s.duration) ||
    s.duration < 10 ||
    s.duration > 360 ||
    !['classic', 'telugu-movies'].includes(s.category ?? 'classic') ||
    !['setup', 'acting', 'scoring'].includes(s.phase) ||
    ![0, 1].includes(s.team) ||
    !Number.isInteger(s.actor) ||
    s.actor < 0 ||
    s.actor >= s.players / 2 ||
    !Array.isArray(s.score) ||
    s.score.length !== 2 ||
    !s.score.every((n) => Number.isInteger(n) && n >= 0 && n <= 10) ||
    !Array.isArray(s.wordsUsed) ||
    typeof s.word !== 'string' ||
    typeof s.guessedCorrect !== 'boolean' ||
    !Number.isFinite(s.deadline) ||
    s.deadline < 0 ||
    (s.phase === 'acting' && s.deadline <= 0)
  )
    return false;
  if (
    s.yearRange &&
    (!Array.isArray(s.yearRange) ||
      s.yearRange.length !== 2 ||
      !s.yearRange.every(Number.isInteger) ||
      s.yearRange[0] > s.yearRange[1])
  )
    return false;
  if (
    s.difficulties &&
    (!Array.isArray(s.difficulties) ||
      !s.difficulties.length ||
      s.difficulties.some((n) => !['1', '2', '3', '4', '5'].includes(n)))
  )
    return false;
  const category = s.category ?? 'classic';
  const prompts =
    category === 'classic'
      ? CHARADES_WORDS
      : movies
        ? [
            ...charadesPrompts(category, movies, s),
            ...(!s.yearRange && !s.difficulties && s.period === undefined
              ? movies.map((m) => m.title)
              : []),
          ]
        : null;
  return (
    (s.phase === 'setup'
      ? s.word === ''
      : (!prompts || prompts.includes(s.word)) &&
        s.wordsUsed.includes(s.word)) &&
    s.wordsUsed.every(
      (word) =>
        typeof word === 'string' && (!prompts || prompts.includes(word)),
    ) &&
    (!prompts || s.wordsUsed.length <= prompts.length)
  );
}
export function newCharades(
  players: number,
  duration: number,
  category: CharadesState['category'],
  filters: MovieFilters,
): CharadesState {
  return {
    players,
    duration,
    category,
    ...filters,
    phase: 'setup',
    team: 0,
    actor: 0,
    score: [0, 0],
    word: '',
    wordsUsed: [],
    guessedCorrect: false,
    deadline: 0,
  };
}
export function beginCharades(
  s: CharadesState,
  movies: Movie[],
  now = Date.now(),
  random = Math.random,
): CharadesState {
  if (s.phase !== 'setup') return s;
  const prompts = charadesPrompts(s.category ?? 'classic', movies, s),
    unused = prompts.filter((w) => !s.wordsUsed.includes(w)),
    choices = unused.length ? unused : prompts;
  if (!choices.length) return s;
  const word = choices[Math.floor(random() * choices.length)];
  return {
    ...s,
    word,
    wordsUsed: [...(unused.length ? s.wordsUsed : []), word],
    phase: 'acting',
    deadline: now + s.duration * 1000,
  };
}
export function scoreCharades(
  s: CharadesState,
  correct: boolean,
): CharadesState {
  if (s.phase !== 'acting') return s;
  const score: [number, number] = [...s.score];
  if (correct) score[s.team]++;
  return {
    ...s,
    score,
    guessedCorrect: correct,
    phase: 'scoring',
    deadline: 0,
  };
}
export function nextCharades(s: CharadesState): CharadesState {
  if (s.phase !== 'scoring') return s;
  const team = s.team === 0 ? 1 : 0,
    actor = team === 0 ? (s.actor + 1) % (s.players / 2) : s.actor;
  return {
    ...s,
    team,
    actor,
    phase: team === 0 && s.score[0] + s.score[1] >= 10 ? 'gameover' : 'setup',
    word: '',
    deadline: 0,
  };
}
