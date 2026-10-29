import { useEffect, useRef, useState } from 'react';
import { Frame, useRun } from '../components/GameFrame.tsx';
import {
  MovieLoader,
  MovieFiltersControl,
  MovieDetails,
} from '../components/MovieLibrary.tsx';
import {
  filterMovies,
  uniqueMovies,
  normalizeMovieFilters,
} from '../lib/movies.ts';
import type { Movie, MovieFilters } from '../lib/movies.ts';
import {
  validCharades,
  newCharades,
  beginCharades,
  scoreCharades,
  nextCharades,
} from '../lib/charades.ts';
import type { CharadesState } from '../lib/charades.ts';
import { KEYS, loadJSON, saveJSON } from '../lib/storage.ts';
import { names as readNames } from '../lib/profile.ts';
export function CharadesGame() {
  return (
    <MovieLoader>{(movies) => <CharadesLoaded movies={movies} />}</MovieLoader>
  );
}
function CharadesLoaded({ movies }: { movies: Movie[] }) {
  const saved = loadJSON<Partial<CharadesState> & { timer?: string }>(
    `${KEYS.SETTINGS}:dumb-charades`,
    {},
  );
  const [filters, setFilters] = useState<MovieFilters>(() =>
    normalizeMovieFilters(movies, {
      yearRange: saved.yearRange,
      difficulties: saved.difficulties,
      period: saved.period,
      fromYear: saved.fromYear,
      toYear: saved.toYear,
      difficulty: saved.difficulty,
    }),
  );
  const [names] = useState(readNames),
    [now, setNow] = useState(Date.now),
    [error, setError] = useState('');
  const run = useRun<CharadesState>(
    'dumb-charades',
    { players: '4', timer: '60', category: 'classic' },
    (value) => validCharades(value, movies),
    (s) =>
      newCharades(
        [2, 4, 6, 8].includes(Number(s.players)) ? Number(s.players) : 4,
        Math.max(10, Math.min(360, Number(s.timer) || 60)),
        s.category === 'telugu-movies' ? 'telugu-movies' : 'classic',
        filters,
      ),
    (s) => s.phase === 'gameover',
  );
  const s = run.state,
    latest = useRef(s);
  latest.current = s;
  useEffect(() => {
    if (s) {
      setFilters(normalizeMovieFilters(movies, s));
      run.setSettings({
        players: String(s.players),
        timer: String(s.duration),
        category: s.category ?? 'classic',
      });
    }
  }, []);
  function commit(next: CharadesState) {
    latest.current = next;
    run.commit(next, next.phase === 'gameover');
  }
  useEffect(() => {
    if (s?.phase !== 'acting') return;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (time >= s.deadline && latest.current?.phase === 'acting')
        commit(scoreCharades(latest.current, false));
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [s]);
  function start() {
    if (
      run.settings.category === 'telugu-movies' &&
      (!uniqueMovies(filterMovies(movies, filters)).length ||
        filters.difficulties?.length === 0 ||
        (filters.yearRange && filters.yearRange[0] > filters.yearRange[1]))
    ) {
      setError(
        'Choose valid years and at least one difficulty with matching movies.',
      );
      return;
    }
    setError('');
    run.start();
    saveJSON(`${KEYS.SETTINGS}:dumb-charades`, { ...run.settings, ...filters });
  }
  const finished = s?.phase === 'gameover',
    movie =
      s?.category === 'telugu-movies'
        ? movies.find((m) => m.prompt === s.word || m.title === s.word)
        : undefined;
  const actor = s ? s.team * (s.players / 2) + s.actor : 0;
  return (
    <Frame
      run={{ ...run, start }}
      fields={[
        {
          key: 'players',
          label: 'Players',
          options: [2, 4, 6, 8].map((n) => [String(n), `${n} players`]),
        },
        {
          key: 'category',
          label: 'Category',
          options: [
            ['classic', 'Classic prompts'],
            ['telugu-movies', 'Telugu movies'],
          ],
        },
      ]}
      summary="Act it out. Your team guesses against the clock."
      title={
        finished
          ? s.score[0] === s.score[1]
            ? 'A tie game!'
            : `Team ${s.score[0] > s.score[1] ? 1 : 2} wins!`
          : s?.phase === 'scoring'
            ? s.guessedCorrect
              ? 'Correct!'
              : 'Skipped'
            : s?.phase === 'acting'
              ? 'Act this out!'
              : `Team ${(s?.team ?? 0) + 1} · ${names[actor] || `Player ${actor + 1}`}`
      }
      status={
        s?.phase === 'acting'
          ? 'No speaking or mouthing words!'
          : s?.phase === 'scoring'
            ? `The prompt was ${s.word}.`
            : finished
              ? 'Ten correct guesses completed the match.'
              : 'Pass the device to the actor. Everyone else, look away.'
      }
      help="Teams take turns acting out prompts without speaking. The actor reveals a prompt and the clock starts. Score a point for a correct guess or skip. After both teams have played, a match ends when there are ten correct guesses in total."
      optionsExtra={
        <>
          <label className="setup-card">
            Turn timer (10–360 seconds)
            <input
              type="number"
              min="10"
              max="360"
              value={run.settings.timer}
              onChange={(e) =>
                run.setSettings({ ...run.settings, timer: e.target.value })
              }
            />
          </label>
          {run.settings.category === 'telugu-movies' && (
            <div className="setup-card">
              <MovieFiltersControl
                movies={movies}
                filters={filters}
                change={setFilters}
              />
            </div>
          )}
        </>
      }
      setupExtra={error && <p role="alert">{error}</p>}
      after={
        s && (
          <>
            <div className="score-line">
              <span>
                Team 1 <strong>{s.score[0]}</strong>
              </span>
              <span>
                Team 2 <strong>{s.score[1]}</strong>
              </span>
            </div>
            {s.phase === 'setup' && (
              <button
                className="primary"
                onClick={() => commit(beginCharades(s, movies))}
              >
                Show word
              </button>
            )}
            {s.phase === 'acting' && (
              <div className="actions">
                <button
                  className="primary"
                  onClick={() =>
                    latest.current?.phase === 'acting' &&
                    commit(scoreCharades(latest.current, true))
                  }
                >
                  Team guessed it!
                </button>
                <button
                  className="quiet"
                  onClick={() =>
                    latest.current?.phase === 'acting' &&
                    commit(scoreCharades(latest.current, false))
                  }
                >
                  Skip
                </button>
              </div>
            )}
            {s.phase === 'scoring' && (
              <button
                className="primary"
                onClick={() => commit(nextCharades(s))}
              >
                {s.team === 1 ? 'Next round' : 'Switch teams'}
              </button>
            )}
            {finished && (
              <button className="primary" onClick={start}>
                Play again
              </button>
            )}
          </>
        )
      }
    >
      {s?.phase === 'acting' && (
        <div className="charades-prompt">
          <p>{s.word}</p>
          <strong>{Math.max(0, Math.ceil((s.deadline - now) / 1000))}s</strong>
          <MovieDetails movie={movie} compact />
        </div>
      )}
      {s?.phase === 'scoring' && <MovieDetails movie={movie} />}
    </Frame>
  );
}
