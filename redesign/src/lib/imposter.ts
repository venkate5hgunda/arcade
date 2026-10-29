import catalog from '../data/imposter.ts';
import { filterMovies, uniqueMovies } from './movies.ts';
import type { Movie, MovieFilters } from './movies.ts';
export const IMPOSTER_CATEGORIES = catalog.categories;
export const WORD_CATEGORY_IDS = IMPOSTER_CATEGORIES.map((c) => c.id);
export const maxImposters = (n: number) =>
  Math.max(1, Math.min(6, Math.floor((n - 1) / 2)));
export type Intel = 'category' | 'hint' | 'team';
export interface ImposterState extends MovieFilters {
  players: number;
  mode: 'classic' | 'pair';
  intel: Intel[];
  imposterRange: number[];
  categories: string[];
  category: string;
  phase: 'setup' | 'reveal' | 'discuss' | 'vote' | 'verdict' | 'result';
  currentPlayer: number;
  round: number;
  starter: number;
  imposters: number[];
  out: number[];
  history: { round: number; out: number | null }[];
  word: string;
  hint: string;
  decoy: string;
  votes: (number | null)[];
  legacy?: boolean;
}
export function migrateImposter(value: unknown): ImposterState {
  const s = value as ImposterState & { imposterIndex?: number; clue?: string };
  if (!s || s.imposters || !Number.isInteger(s.imposterIndex)) return s;
  const category = s.category ?? 'everyday';
  if (!['everyday', 'telugu-movies'].includes(category))
    return null as unknown as ImposterState;
  return {
    ...s,
    legacy: true,
    mode: 'classic',
    intel: ['category', 'hint', 'team'],
    imposterRange: [1, 1],
    imposters: [s.imposterIndex!],
    categories: [category],
    category,
    hint: s.clue ?? '',
    decoy: '',
    out: [],
    history: [],
    round: 1,
    starter: 0,
  };
}
export function validImposter(value: unknown, movies?: Movie[]): boolean {
  const s = migrateImposter(value);
  if (!s) return false;
  const n = s.players,
    seat = (v: unknown): v is number =>
      Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;
  const unique = (list: unknown): list is number[] =>
    Array.isArray(list) && new Set(list).size === list.length;
  if (
    !Number.isInteger(n) ||
    n < 3 ||
    n > 20 ||
    !['classic', 'pair'].includes(s.mode) ||
    !Array.isArray(s.intel) ||
    !s.intel.every((i) => ['category', 'hint', 'team'].includes(i)) ||
    !Array.isArray(s.categories) ||
    !s.categories.length ||
    new Set(s.categories).size !== s.categories.length ||
    !s.categories.every((id) =>
      [
        ...WORD_CATEGORY_IDS,
        'telugu-movies',
        ...(s.legacy ? ['everyday'] : []),
      ].includes(id),
    ) ||
    !s.categories.includes(s.category) ||
    !unique(s.imposters) ||
    !s.imposters.length ||
    s.imposters.length > maxImposters(n) ||
    !s.imposters.every(seat) ||
    !unique(s.out) ||
    !s.out.every(seat) ||
    !Array.isArray(s.history)
  )
    return false;
  if (s.categories.includes('telugu-movies')) {
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
        s.difficulties.some((v) => !['1', '2', '3', '4', '5'].includes(v)))
    )
      return false;
    if (movies && !filterMovies(movies, s).length) return false;
  }
  const living = (i: number) => !s.out.includes(i),
    spies = s.imposters.filter(living).length;
  if (
    !spies ||
    spies >= n - s.out.length - spies ||
    !['setup', 'reveal', 'discuss', 'vote', 'verdict'].includes(s.phase) ||
    (['setup', 'reveal'].includes(s.phase) && s.out.length) ||
    !seat(s.currentPlayer) ||
    !living(s.currentPlayer) ||
    !Number.isInteger(s.round) ||
    s.round < 1 ||
    typeof s.word !== 'string' ||
    typeof s.hint !== 'string' ||
    typeof s.decoy !== 'string' ||
    (s.mode === 'pair' && !s.decoy)
  )
    return false;
  if (
    !Array.isArray(s.votes) ||
    s.votes.length !== n ||
    !s.votes.every(
      (vote, voter) =>
        vote === null ||
        (living(voter) && seat(vote) && living(vote) && vote !== voter),
    ) ||
    (s.phase === 'vote' &&
      !s.votes.slice(s.currentPlayer + 1).every((v) => v === null))
  )
    return false;
  if (s.category === 'everyday')
    return (
      !!s.legacy &&
      catalog.legacy.some((e) => e.word === s.word && e.hint === s.hint)
    );
  if (s.category === 'telugu-movies') {
    const legacy =
      s.legacy &&
      !s.yearRange &&
      !s.difficulties &&
      s.period === undefined &&
      [
        ['Eega', 'Fantasy revenge'],
        ['Baahubali: The Beginning', 'Epic fantasy'],
        ['Pushpa: The Rise', 'Crime drama'],
        ['RRR', 'Period action'],
      ].some(([word, hint]) => word === s.word && hint === s.hint);
    return (
      !movies ||
      !!legacy ||
      uniqueMovies(filterMovies(movies, s)).some(
        (m) => (m.prompt === s.word || m.title === s.word) && m.clue === s.hint,
      )
    );
  }
  return !!IMPOSTER_CATEGORIES.find((c) => c.id === s.category)?.words.some(
    (e) => e.word === s.word && e.hint === s.hint && e.decoy === s.decoy,
  );
}
export function imposterWinner(s: ImposterState): 'town' | 'imposters' | null {
  const spies = s.imposters.filter((i) => !s.out.includes(i)).length,
    alive = s.players - s.out.length;
  return !spies ? 'town' : spies >= alive - spies ? 'imposters' : null;
}
export function newImposter(
  players: number,
  mode: 'classic' | 'pair',
  range: number[],
  intel: Intel[],
  categories: string[],
  filters: MovieFilters,
  movies: Movie[],
  random = Math.random,
): ImposterState {
  const randomItem = <T>(list: T[]) => list[Math.floor(random() * list.length)];
  const moviePool = uniqueMovies(filterMovies(movies, filters));
  // A one-film pool cannot produce a decoy; other selected categories remain usable.
  const usable =
    mode === 'pair' && moviePool.length < 2
      ? categories.filter((id) => id !== 'telugu-movies')
      : categories;
  const category = randomItem(usable);
  let word = '',
    hint = '',
    decoy = '';
  if (category === 'telugu-movies') {
    const movie = randomItem(moviePool);
    word = movie.prompt;
    hint = movie.clue;
    const others = moviePool.filter((m) => m.prompt !== word);
    if (others.length) {
      const distance = (m: Movie) =>
        (m.difficulty === movie.difficulty ? 0 : 1000) +
        Math.abs((m.year ?? 0) - (movie.year ?? 0));
      const min = Math.min(...others.map(distance));
      decoy = others.find((m) => distance(m) === min)!.prompt;
    }
  } else {
    const entry = randomItem(
      IMPOSTER_CATEGORIES.find((c) => c.id === category)!.words,
    );
    ({ word, hint, decoy } = entry);
  }
  const count = range[0] + Math.floor(random() * (range[1] - range[0] + 1)),
    seats = Array.from({ length: players }, (_, i) => i);
  for (let i = seats.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [seats[i], seats[j]] = [seats[j], seats[i]];
  }
  return {
    players,
    mode,
    imposterRange: range,
    intel,
    categories,
    ...filters,
    category,
    word,
    hint,
    decoy,
    phase: 'setup',
    currentPlayer: 0,
    round: 1,
    starter: Math.floor(random() * players),
    imposters: seats.slice(0, count).sort((a, b) => a - b),
    out: [],
    history: [],
    votes: Array(players).fill(null),
  };
}
export function hideImposterCard(s: ImposterState): ImposterState {
  if (s.phase !== 'setup' && s.phase !== 'reveal') return s;
  return s.currentPlayer < s.players - 1
    ? { ...s, phase: 'setup', currentPlayer: s.currentPlayer + 1 }
    : { ...s, phase: 'discuss', currentPlayer: s.starter };
}
export function beginImposterVote(s: ImposterState): ImposterState {
  if (s.phase !== 'discuss') return s;
  return {
    ...s,
    phase: 'vote',
    currentPlayer: Array.from({ length: s.players }, (_, i) => i).find(
      (i) => !s.out.includes(i),
    )!,
    votes: Array(s.players).fill(null),
  };
}
export function lockImposterVote(
  s: ImposterState,
  vote: number,
): ImposterState {
  if (
    s.phase !== 'vote' ||
    !Number.isInteger(vote) ||
    vote < 0 ||
    vote >= s.players ||
    vote === s.currentPlayer ||
    s.out.includes(vote)
  )
    return s;
  const votes = [...s.votes];
  votes[s.currentPlayer] = vote;
  const next = Array.from({ length: s.players }, (_, i) => i).find(
    (i) => i > s.currentPlayer && !s.out.includes(i),
  );
  if (next !== undefined) return { ...s, votes, currentPlayer: next };
  const counts = Array(s.players).fill(0);
  votes.forEach((v) => {
    if (v !== null) counts[v]++;
  });
  const max = Math.max(...counts),
    leaders = counts.flatMap((n, i) => (n === max ? [i] : [])),
    eliminated = leaders.length === 1 ? leaders[0] : null,
    out = eliminated === null ? s.out : [...s.out, eliminated];
  const nextState: ImposterState = {
    ...s,
    votes,
    out,
    history: [...s.history, { round: s.round, out: eliminated }],
    round: s.round + 1,
    currentPlayer: Array.from({ length: s.players }, (_, i) => i).find(
      (i) => !out.includes(i),
    )!,
  };
  return {
    ...nextState,
    phase: imposterWinner(nextState) ? 'result' : 'verdict',
  };
}
export function nextImposterRound(
  s: ImposterState,
  random = Math.random,
): ImposterState {
  if (s.phase !== 'verdict') return s;
  const alive = Array.from({ length: s.players }, (_, i) => i).filter(
      (i) => !s.out.includes(i),
    ),
    starter = alive[Math.floor(random() * alive.length)];
  return { ...s, phase: 'discuss', starter, currentPlayer: starter };
}
