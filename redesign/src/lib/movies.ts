// Approved movie data is copied directly from the original publishing pipeline.
export interface Movie {
  id: string;
  title: string;
  year: number | null;
  difficulty: number;
  approval: string;
  cast?: string[];
  summary?: string;
  genres?: string[];
  reason?: string;
  components?: Record<string, { value: number; reason: string }>;
  credits?: { cast?: string; summary?: string; wikipedia?: string };
  prompt: string;
  clue: string;
  source?: string;
  story?: string;
}
export interface MovieFilters {
  yearRange?: number[];
  difficulties?: string[];
  period?: string;
  fromYear?: string;
  toYear?: string;
  difficulty?: string;
}
const STARTERS: Record<string, Partial<Movie>> = {
  'Eega|2012': {
    cast: ['Nani', 'Samantha Ruth Prabhu', 'Sudeep'],
    story:
      'A murdered man returns as a housefly to take revenge on the businessman who killed him.',
    source: 'https://en.wikipedia.org/wiki/Eega',
  },
  'Baahubali: The Beginning|2015': {
    cast: ['Prabhas', 'Rana Daggubati', 'Anushka Shetty', 'Tamannaah Bhatia'],
    story:
      'A young man discovers his royal origins while helping to rescue a woman held captive in Mahishmati.',
    source: 'https://en.wikipedia.org/wiki/Baahubali:_The_Beginning',
  },
  'Pushpa: The Rise|2021': {
    cast: ['Allu Arjun', 'Rashmika Mandanna', 'Fahadh Faasil'],
    story:
      'A laborer climbs the ranks of a red sandalwood smuggling syndicate.',
    source: 'https://en.wikipedia.org/wiki/Pushpa:_The_Rise',
  },
  'RRR|2022': {
    cast: ['N. T. Rama Rao Jr.', 'Ram Charan', 'Alia Bhatt', 'Ajay Devgn'],
    story:
      'Two men with opposing missions become friends while fighting British colonial rule.',
    source: 'https://en.wikipedia.org/wiki/RRR',
  },
};
export async function loadMovies(
  base = typeof document === 'undefined'
    ? 'data/movies/'
    : new URL('data/movies/', document.baseURI).href,
  fetcher: typeof fetch = fetch,
): Promise<Movie[]> {
  const indexResponse = await fetcher(`${base}index.json`);
  if (!indexResponse.ok)
    throw new Error(
      `Movie index could not load (HTTP ${indexResponse.status}).`,
    );
  const index = (await indexResponse.json()) as {
    format_version: number;
    records: number;
    files: { path: string; records: number }[];
  };
  if (index.format_version !== 1 || !Array.isArray(index.files))
    throw new Error('Invalid movie index.');
  const result: Movie[] = [];
  for (const file of index.files) {
    if (!/^[\w.-]+\.jsonl$/.test(file.path))
      throw new Error('Invalid movie partition path.');
    const response = await fetcher(`${base}${file.path}`);
    if (!response.ok)
      throw new Error(
        `Movie library could not load (HTTP ${response.status}).`,
      );
    const text = await response.text(),
      rows = text.trim()
        ? text
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line))
        : [];
    if (rows.length !== file.records)
      throw new Error('Incomplete movie partition.');
    result.push(...rows);
  }
  if (!result.length || result.length !== index.records)
    throw new Error('Incomplete or empty movie library.');
  const ids = new Set<string>();
  return result.map((movie) => {
    if (
      !movie ||
      typeof movie.id !== 'string' ||
      !movie.id ||
      ids.has(movie.id) ||
      typeof movie.title !== 'string' ||
      !movie.title.trim() ||
      !(movie.year === null || Number.isInteger(movie.year)) ||
      !Number.isInteger(movie.difficulty) ||
      movie.difficulty < 1 ||
      movie.difficulty > 5 ||
      !['editorial', 'llm_reviewed'].includes(movie.approval) ||
      !(
        movie.cast === undefined ||
        (Array.isArray(movie.cast) &&
          movie.cast.every((name) => typeof name === 'string' && !!name.trim()))
      ) ||
      !(
        movie.summary === undefined ||
        (typeof movie.summary === 'string' && !!movie.summary.trim())
      )
    )
      throw new Error('Invalid approved movie record.');
    ids.add(movie.id);
    return {
      ...STARTERS[`${movie.title}|${movie.year}`],
      ...movie,
      prompt: `${movie.title} (${movie.year ?? 'year unknown'})`,
      clue: movie.genres?.length
        ? movie.genres.slice(0, 2).join(' / ')
        : 'Telugu cinema',
    };
  });
}
export function filterMovies(
  movies: Movie[],
  settings: MovieFilters = {},
): Movie[] {
  return movies.filter((movie) => {
    if (
      Array.isArray(settings.difficulties) &&
      !settings.difficulties.includes(String(movie.difficulty))
    )
      return false;
    if (
      Array.isArray(settings.yearRange) &&
      !(
        movie.year !== null &&
        movie.year >= settings.yearRange[0] &&
        movie.year <= settings.yearRange[1]
      )
    )
      return false;
    if (
      !Array.isArray(settings.difficulties) &&
      settings.difficulty &&
      settings.difficulty !== 'all' &&
      movie.difficulty !== Number(settings.difficulty)
    )
      return false;
    if (
      !Array.isArray(settings.yearRange) &&
      settings.period === '2000' &&
      !(movie.year !== null && movie.year >= 2000)
    )
      return false;
    if (
      !Array.isArray(settings.yearRange) &&
      settings.period === '1990' &&
      !(movie.year !== null && movie.year >= 1990)
    )
      return false;
    if (
      !Array.isArray(settings.yearRange) &&
      settings.period === 'older' &&
      !(movie.year !== null && movie.year < 2000)
    )
      return false;
    if (
      !Array.isArray(settings.yearRange) &&
      settings.period === 'custom' &&
      !(
        movie.year !== null &&
        movie.year >= Number(settings.fromYear) &&
        movie.year <= Number(settings.toYear)
      )
    )
      return false;
    return true;
  });
}
export function uniqueMovies(movies: Movie[]): Movie[] {
  return [...new Map(movies.map((movie) => [movie.prompt, movie])).values()];
}
export const DIFFICULTIES = [
  'Easy',
  'Approachable',
  'Moderate',
  'Hard',
  'Very hard',
];

export function normalizeMovieFilters(
  movies: Movie[],
  saved: MovieFilters,
): MovieFilters {
  const years = movies
      .map((m) => m.year)
      .filter((n): n is number => n !== null),
    min = Math.min(...years),
    max = Math.max(...years);
  const legacy =
    saved.period === 'all'
      ? [min, max]
      : saved.period === 'older'
        ? [min, 1999]
        : saved.period === 'custom'
          ? [Number(saved.fromYear), Number(saved.toYear)]
          : [saved.period === '1990' ? 1990 : 2000, max];
  const range = saved.yearRange ?? legacy,
    clamp = (n: number) =>
      Math.max(min, Math.min(max, Number.isFinite(n) ? n : max));
  const first = clamp(Number(range[0])),
    last = clamp(Number(range[1]));
  return {
    yearRange: [Math.min(first, last), Math.max(first, last)],
    difficulties:
      saved.difficulties ??
      (['1', '2', '3', '4', '5'].includes(saved.difficulty ?? '')
        ? [saved.difficulty!]
        : ['1', '2', '3', '4', '5']),
  };
}
