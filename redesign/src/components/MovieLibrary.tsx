import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DIFFICULTIES,
  loadMovies,
  filterMovies,
  uniqueMovies,
} from '../lib/movies.ts';
import type { Movie, MovieFilters } from '../lib/movies.ts';
export function MovieLoader({
  children,
  title = 'Dumb Charades',
}: {
  children: (movies: Movie[]) => React.ReactNode;
  title?: string;
}) {
  const [movies, setMovies] = useState<Movie[] | null>(null),
    [attempt, setAttempt] = useState(0),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setError('');
    loadMovies()
      .then((value) => {
        if (live) setMovies(value);
      })
      .catch((reason) => {
        if (live)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Movie library could not load.',
          );
      });
    return () => {
      live = false;
    };
  }, [attempt]);
  if (movies) return children(movies);
  return (
    <section className="play-page">
      <Link className="back" to="/">
        ← Back to the shelf
      </Link>
      <h1>{title}</h1>
      <div className="setup-card" role="status">
        {error ? (
          <>
            <p>{error} Check your connection and retry.</p>
            <button className="quiet" onClick={() => setAttempt(attempt + 1)}>
              Retry movie library
            </button>
          </>
        ) : (
          <p>Loading approved Telugu movie library…</p>
        )}
      </div>
    </section>
  );
}
export function MovieFiltersControl({
  movies,
  filters,
  change,
}: {
  movies: Movie[];
  filters: MovieFilters;
  change: (next: MovieFilters) => void;
}) {
  const years = movies
      .map((m) => m.year)
      .filter((n): n is number => n !== null),
    min = Math.min(...years),
    max = Math.max(...years);
  const range = filters.yearRange ?? [min, max],
    difficulties = filters.difficulties ?? ['1', '2', '3', '4', '5'];
  const count = uniqueMovies(
    filterMovies(movies, { ...filters, yearRange: range, difficulties }),
  ).length;
  return (
    <fieldset className="movie-filters">
      <legend>Movie filters</legend>
      <p>{count.toLocaleString()} movies match</p>
      <label>
        From year{' '}
        <input
          type="number"
          min={min}
          max={max}
          value={range[0]}
          onChange={(e) =>
            change({
              ...filters,
              yearRange: [Number(e.target.value), range[1]],
              difficulties,
            })
          }
        />
      </label>
      <label>
        To year{' '}
        <input
          type="number"
          min={min}
          max={max}
          value={range[1]}
          onChange={(e) =>
            change({
              ...filters,
              yearRange: [range[0], Number(e.target.value)],
              difficulties,
            })
          }
        />
      </label>
      <fieldset>
        <legend>Difficulty</legend>
        {DIFFICULTIES.map((name, i) => {
          const value = String(i + 1);
          return (
            <label key={value}>
              <input
                type="checkbox"
                checked={difficulties.includes(value)}
                onChange={(e) =>
                  change({
                    ...filters,
                    yearRange: range,
                    difficulties: e.target.checked
                      ? [...difficulties, value]
                      : difficulties.filter((n) => n !== value),
                  })
                }
              />{' '}
              {i + 1} · {name}
            </label>
          );
        })}
      </fieldset>
      {(range[0] > range[1] || !difficulties.length || !count) && (
        <p role="alert">
          Choose valid years and at least one difficulty with matching movies.
        </p>
      )}
    </fieldset>
  );
}
export function MovieDetails({
  movie,
  compact = false,
}: {
  movie?: Movie;
  compact?: boolean;
}) {
  if (!movie) return null;
  const sources = [
    ...new Set(
      [movie.credits?.cast, movie.credits?.summary].filter(
        (source): source is string => !!source,
      ),
    ),
  ];
  const sourceLinks: Record<string, { label: string; href?: string }> = {
    tmdb: { label: 'TMDB', href: 'https://www.themoviedb.org/' },
    omdb: { label: 'OMDb', href: 'https://www.omdbapi.com/' },
    source: { label: 'Telugu movie dataset' },
    wikipedia: {
      label: 'Wikipedia (CC BY-SA)',
      href: movie.credits?.wikipedia
        ? `https://en.wikipedia.org/wiki/${encodeURIComponent(movie.credits.wikipedia.replaceAll(' ', '_'))}`
        : undefined,
    },
  };
  return (
    <div className="movie-brief">
      {!compact && <p>{movie.year ?? 'Year unknown'}</p>}
      {!!movie.cast?.length && (
        <p>
          <b>Starring:</b> {movie.cast.slice(0, 3).join(', ')}
        </p>
      )}
      {(movie.summary || movie.story) && <p>{movie.summary || movie.story}</p>}
      {!compact && (
        <>
          <p>
            Difficulty {movie.difficulty}/5 ·{' '}
            {DIFFICULTIES[movie.difficulty - 1]} ·{' '}
            {movie.approval === 'editorial' ? 'Editorial' : 'Model approved'}
          </p>
          <details>
            <summary>Why this rating?</summary>
            <p>{movie.reason}</p>
            {movie.components &&
              Object.entries(movie.components).map(([key, value]) => (
                <p key={key}>
                  <b>
                    {key.replaceAll('_', ' ')}: {value.value}/5.
                  </b>{' '}
                  {value.reason}
                </p>
              ))}
          </details>
        </>
      )}
      {(sources.length > 0 || movie.source) && (
        <p>
          via{' '}
          {sources.length ? (
            sources.map((source, i) => {
              const credit = sourceLinks[source];
              return (
                credit && (
                  <span key={source}>
                    {i > 0 && ' · '}
                    {credit.href ? (
                      <a href={credit.href} target="_blank" rel="noreferrer">
                        {credit.label}
                      </a>
                    ) : (
                      credit.label
                    )}
                  </span>
                )
              );
            })
          ) : (
            <a href={movie.source} target="_blank" rel="noreferrer">
              Wikipedia
            </a>
          )}
        </p>
      )}
      {!compact && movie.approval && (
        <p>
          Movie metadata:{' '}
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noreferrer"
          >
            TMDB
          </a>
          . Not endorsed or certified by TMDB.
        </p>
      )}
    </div>
  );
}
