import { useEffect, useState } from 'react';
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
  IMPOSTER_CATEGORIES,
  WORD_CATEGORY_IDS,
  maxImposters,
  validImposter,
  migrateImposter,
  newImposter,
  imposterWinner,
  hideImposterCard,
  beginImposterVote,
  lockImposterVote,
  nextImposterRound,
} from '../lib/imposter.ts';
import type { ImposterState, Intel } from '../lib/imposter.ts';
import { KEYS, loadJSON, saveJSON } from '../lib/storage.ts';
import { names as readNames } from '../lib/profile.ts';
export function ImposterGame() {
  return (
    <MovieLoader title="Imposter">
      {(movies) => <ImposterLoaded movies={movies} />}
    </MovieLoader>
  );
}
function ImposterLoaded({ movies }: { movies: Movie[] }) {
  const saved = loadJSON<Partial<ImposterState> & { imposterRandom?: string }>(
    `${KEYS.SETTINGS}:imposter`,
    {},
  );
  const [categories, setCategories] = useState<string[]>(
    () =>
      saved.categories?.filter((id) =>
        [...WORD_CATEGORY_IDS, 'telugu-movies'].includes(id),
      ) ??
      (saved.category === 'telugu-movies'
        ? ['telugu-movies']
        : [...WORD_CATEGORY_IDS]),
  );
  const [intel, setIntel] = useState<Intel[]>(
    () =>
      saved.intel?.filter((i) => ['category', 'hint', 'team'].includes(i)) ?? [
        'category',
        'hint',
        'team',
      ],
  );
  const [range, setRange] = useState<number[]>(() =>
    Array.isArray(saved.imposterRange) && saved.imposterRange.length === 2
      ? saved.imposterRange.map(Number)
      : [1, 1],
  );
  const [filters, setFilters] = useState<MovieFilters>(() =>
    normalizeMovieFilters(movies, saved),
  );
  const [names] = useState(readNames),
    [visible, setVisible] = useState(false),
    [ballot, setBallot] = useState(false),
    [selection, setSelection] = useState<number | null>(null),
    [error, setError] = useState('');
  const run = useRun<ImposterState>(
    'imposter',
    { players: '4', mode: 'classic' },
    (value) => validImposter(value, movies),
    (s) =>
      newImposter(
        Number(s.players),
        s.mode === 'pair' ? 'pair' : 'classic',
        range,
        s.mode === 'pair' ? [] : intel,
        categories,
        filters,
        movies,
      ),
    (s) => s.phase === 'result',
    (value) => {
      const state = migrateImposter(value);
      return {
        ...state,
        phase: state.phase === 'reveal' ? 'setup' : state.phase,
      };
    },
  );
  const s = run.state;
  useEffect(() => {
    if (s) {
      run.setSettings({ players: String(s.players), mode: s.mode });
      setCategories(
        s.categories.includes('everyday')
          ? [...WORD_CATEGORY_IDS]
          : s.categories,
      );
      setRange(s.imposterRange ?? [1, 1]);
      setIntel(s.intel);
      setFilters(normalizeMovieFilters(movies, s));
    }
  }, []);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        setVisible(false);
        setBallot(false);
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  const label = (i: number) => names[i] || `Player ${i + 1}`;
  const limit = maxImposters(Number(run.settings.players) || 4);
  function start() {
    const available = uniqueMovies(filterMovies(movies, filters));
    if (!categories.length) {
      setError('Choose at least one category.');
      return;
    }
    if (range[0] < 1 || range[0] > range[1] || range[1] > limit) {
      setError(`Choose between 1 and ${limit} imposters for this table.`);
      return;
    }
    if (
      categories.includes('telugu-movies') &&
      (!available.length ||
        filters.difficulties?.length === 0 ||
        (filters.yearRange && filters.yearRange[0] > filters.yearRange[1]))
    ) {
      setError(
        'Choose valid movie years and at least one difficulty with matching movies.',
      );
      return;
    }
    if (
      run.settings.mode === 'pair' &&
      categories.length === 1 &&
      categories[0] === 'telugu-movies' &&
      available.length < 2
    ) {
      setError('Pair mode needs at least two matching movies.');
      return;
    }
    setVisible(false);
    setBallot(false);
    setSelection(null);
    setError('');
    run.start();
    saveJSON(`${KEYS.SETTINGS}:imposter`, {
      ...run.settings,
      imposterRange: range,
      imposterRandom: String(range[0] !== range[1]),
      intel,
      categories,
      ...filters,
    });
  }
  function toggle<T>(list: T[], item: T, set: (value: T[]) => void) {
    set(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  }
  const name = s ? label(s.currentPlayer) : 'Player 1',
    spy = !!s?.imposters.includes(s.currentPlayer),
    winner = s?.phase === 'result' ? imposterWinner(s) : null,
    last = s?.history.at(-1),
    movie =
      s?.category === 'telugu-movies'
        ? movies.find((m) => m.prompt === s.word || m.title === s.word)
        : undefined;
  const categoryName = (id: string) =>
    id === 'telugu-movies'
      ? 'Telugu movies'
      : id === 'everyday'
        ? 'Everyday words'
        : (IMPOSTER_CATEGORIES.find((c) => c.id === id)?.label ?? id);
  const verdict = last
    ? last.out === null
      ? 'The vote was tied. Nobody leaves.'
      : `${label(last.out)} was voted out and ${s!.imposters.includes(last.out) ? 'was an imposter!' : 'was innocent.'}`
    : '';
  return (
    <Frame
      run={{ ...run, start }}
      fields={[
        {
          key: 'players',
          label: 'Players',
          options: Array.from({ length: 18 }, (_, i) => [
            String(i + 3),
            `${i + 3} players`,
          ]),
        },
        {
          key: 'mode',
          label: 'Mode',
          options: [
            ['classic', 'Classic'],
            ['pair', 'Pair (decoy word)'],
          ],
        },
      ]}
      summary="One secret word. A room full of suspects."
      title={
        s?.phase === 'setup' || s?.phase === 'reveal'
          ? `Pass to ${name}`
          : s?.phase === 'discuss'
            ? 'Discussion'
            : s?.phase === 'vote'
              ? `${name} votes`
              : s?.phase === 'verdict'
                ? 'The game continues'
                : winner === 'town'
                  ? 'The crew caught every imposter!'
                  : 'The imposters win!'
      }
      status={
        s?.phase === 'setup' || s?.phase === 'reveal'
          ? 'Everyone else, look away.'
          : s?.phase === 'discuss'
            ? `${label(s.starter)} gives the first clue, then go around the table.`
            : s?.phase === 'vote'
              ? 'Pass the device. Your ballot is private.'
              : s?.phase === 'verdict'
                ? verdict
                : s?.phase === 'result'
                  ? verdict
                  : 'Choose the table and deal secret cards.'
      }
      help="Each player secretly sees a card. In Classic mode imposters bluff without the word; optional intel gives a category, hint or teammates. In Pair mode imposters receive a similar decoy word and nobody is told their role. Discuss, then vote privately. A tie eliminates nobody. The crew wins by catching every imposter; imposters win when they match the remaining crew."
      optionsExtra={
        <>
          <fieldset>
            <legend>Number of imposters</legend>
            <label>
              Fewest{' '}
              <select
                value={range[0]}
                onChange={(e) =>
                  setRange([
                    Number(e.target.value),
                    Math.max(Number(e.target.value), range[1]),
                  ])
                }
              >
                {Array.from({ length: limit }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Most{' '}
              <select
                value={range[1]}
                onChange={(e) =>
                  setRange([
                    Math.min(range[0], Number(e.target.value)),
                    Number(e.target.value),
                  ])
                }
              >
                {Array.from({ length: limit }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <p>Different limits choose a secret random count each game.</p>
          </fieldset>
          {run.settings.mode === 'classic' && (
            <fieldset>
              <legend>Imposters can see</legend>
              {(['category', 'hint', 'team'] as const).map((i) => (
                <label key={i}>
                  <input
                    type="checkbox"
                    checked={intel.includes(i)}
                    onChange={() => toggle(intel, i, setIntel)}
                  />{' '}
                  {i === 'team'
                    ? 'Fellow imposters'
                    : i[0].toUpperCase() + i.slice(1)}
                </label>
              ))}
            </fieldset>
          )}
          <fieldset>
            <legend>Word categories</legend>
            <div className="actions">
              <button
                type="button"
                className="quiet"
                onClick={() =>
                  setCategories([...WORD_CATEGORY_IDS, 'telugu-movies'])
                }
              >
                Select all
              </button>
              <button
                type="button"
                className="quiet"
                onClick={() => setCategories([])}
              >
                Clear all
              </button>
            </div>
            {IMPOSTER_CATEGORIES.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={categories.includes(c.id)}
                  onChange={() => toggle(categories, c.id, setCategories)}
                />{' '}
                {c.emoji} {c.label}
              </label>
            ))}
            <label>
              <input
                type="checkbox"
                checked={categories.includes('telugu-movies')}
                onChange={() =>
                  toggle(categories, 'telugu-movies', setCategories)
                }
              />{' '}
              🎬 Telugu movies
            </label>
          </fieldset>
          {categories.includes('telugu-movies') && (
            <MovieFiltersControl
              movies={movies}
              filters={filters}
              change={setFilters}
            />
          )}
        </>
      }
      setupExtra={error && <p role="alert">{error}</p>}
      after={
        s && (
          <>
            {(s.phase === 'setup' || s.phase === 'reveal') &&
              (visible ? (
                <button
                  className="primary"
                  onClick={() => {
                    setVisible(false);
                    run.commit(hideImposterCard(s));
                  }}
                >
                  {s.currentPlayer === s.players - 1
                    ? 'Hide & start discussion'
                    : 'Hide & pass on'}
                </button>
              ) : (
                <button className="primary" onClick={() => setVisible(true)}>
                  Show my card
                </button>
              ))}
            {s.phase === 'discuss' && (
              <button
                className="primary"
                onClick={() => {
                  setBallot(false);
                  setSelection(null);
                  run.commit(beginImposterVote(s));
                }}
              >
                Start voting
              </button>
            )}
            {s.phase === 'vote' &&
              (ballot ? (
                <button
                  className="primary"
                  disabled={selection === null}
                  onClick={() => {
                    if (selection === null) return;
                    setSelection(null);
                    setBallot(false);
                    run.commit(lockImposterVote(s, selection));
                  }}
                >
                  Lock in vote
                </button>
              ) : (
                <button
                  className="primary"
                  onClick={() => {
                    setSelection(s.votes[s.currentPlayer]);
                    setBallot(true);
                  }}
                >
                  Open my ballot
                </button>
              ))}
            {s.phase === 'verdict' && (
              <button
                className="primary"
                onClick={() => run.commit(nextImposterRound(s))}
              >
                Next round
              </button>
            )}
            {s.phase === 'result' && (
              <button className="primary" onClick={start}>
                Play again
              </button>
            )}
          </>
        )
      }
    >
      {s && (s.phase === 'setup' || s.phase === 'reveal') && visible && (
        <div className="imposter-card">
          {s.mode === 'pair' ? (
            <>
              <p>Your secret word</p>
              <strong>{spy ? s.decoy : s.word}</strong>
              <p>
                Most players share your word, but someone’s is slightly
                different.
              </p>
            </>
          ) : spy ? (
            <>
              <strong>You are an imposter</strong>
              {s.intel.includes('category') && (
                <p>Category: {categoryName(s.category)}</p>
              )}
              {s.intel.includes('hint') && <p>Hint: {s.hint}</p>}
              {s.intel.includes('team') && (
                <p>
                  Team:{' '}
                  {s.imposters
                    .filter((i) => i !== s.currentPlayer)
                    .map(label)
                    .join(', ') || 'You are the only imposter'}
                </p>
              )}
            </>
          ) : (
            <>
              <p>You’re in the crew</p>
              <strong>{s.word}</strong>
              <p>Category: {categoryName(s.category)}</p>
            </>
          )}
        </div>
      )}
      {s?.phase === 'discuss' && (
        <p>
          {s.players - s.out.length} players remain ·{' '}
          {s.imposterRange?.[0] !== s.imposterRange?.[1]
            ? 'Imposter count is secret'
            : `${s.imposters.filter((i) => !s.out.includes(i)).length} imposters left`}
        </p>
      )}
      {s?.phase === 'vote' && ballot && (
        <div
          className="imposter-votes"
          role="group"
          aria-label="Choose a suspect"
        >
          {Array.from({ length: s.players }, (_, i) => (
            <button
              key={i}
              className="quiet"
              disabled={i === s.currentPlayer || s.out.includes(i)}
              aria-pressed={selection === i}
              onClick={async () => {
                const votes = [...s.votes];
                votes[s.currentPlayer] = i;
                await run.commit({ ...s, votes });
                setSelection(i);
              }}
            >
              {label(i)}
              {s.out.includes(i) ? ' · out' : ''}
            </button>
          ))}
        </div>
      )}
      {s?.phase === 'result' && (
        <div className="imposter-result">
          <p>
            Imposters: <strong>{s.imposters.map(label).join(', ')}</strong>
          </p>
          <p>
            The word was <strong>{s.word}</strong>
            {s.mode === 'pair' && (
              <>
                {' '}
                · decoy <strong>{s.decoy}</strong>
              </>
            )}
          </p>
          <p>
            {categoryName(s.category)} · Hint: {s.hint}
          </p>
          <MovieDetails movie={movie} />
          <ol>
            {s.history.map((entry) => (
              <li key={entry.round}>
                Round {entry.round}:{' '}
                {entry.out === null
                  ? 'tie'
                  : `${label(entry.out)} out${s.imposters.includes(entry.out) ? ' 🎯' : ''}`}
              </li>
            ))}
          </ol>
          <div className="imposter-tally">
            <p>Final vote totals</p>
            {Array.from({ length: s.players }, (_, i) => {
              const count = s.votes.filter((v) => v === i).length;
              return (
                (!s.out.includes(i) || count > 0) && (
                  <span key={i}>
                    {label(i)} <b>{count}</b>
                  </span>
                )
              );
            })}
          </div>
        </div>
      )}
    </Frame>
  );
}
