import { useEffect, useState } from 'react';
import type { BeeState } from '../lib/bee.ts';
import { beeProgress, beePuzzle } from '../lib/bee.ts';
import { shuffle } from '../lib/daily.ts';
export function BeeTable({
  state,
  blocked,
  action,
}: {
  state: BeeState;
  blocked: boolean;
  action: (input: unknown) => void;
}) {
  const puzzle = beePuzzle(state.seed),
    progress = beeProgress(state);
  const [word, setWord] = useState(''),
    [outer, setOuter] = useState(() =>
      [...puzzle.letters].filter((c) => c !== puzzle.center),
    );
  useEffect(() => {
    setWord('');
    setOuter(
      [...beePuzzle(state.seed).letters].filter(
        (c) => c !== beePuzzle(state.seed).center,
      ),
    );
  }, [state.seed]);
  useEffect(() => {
    setWord('');
  }, [state.words.length]);
  return (
    <>
      <p className="challenge-edition">
        {state.date ? `Daily · ${state.date}` : 'Practice'} · {progress.rank}
      </p>
      <h3>
        {progress.score} points · {progress.max} available
      </h3>
      <progress
        aria-label="Hive score"
        value={progress.score}
        max={progress.max}
      />
      <div className="bee-hive" role="group" aria-label="Seven letter hive">
        {[puzzle.center, ...outer].map((letter, i) => (
          <button
            className={`bee-cell bee-cell-${i}`}
            key={letter}
            disabled={blocked || progress.done}
            aria-label={i === 0 ? `${letter}, required center letter` : letter}
            onClick={() => setWord((w) => (w + letter).slice(0, 40))}
          >
            {letter}
          </button>
        ))}
      </div>
      {!progress.done && (
        <form
          className="challenge-form"
          onSubmit={(e) => {
            e.preventDefault();
            action({ type: 'word', word });
          }}
        >
          <label>
            Hive word
            <input
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={40}
              value={word}
              disabled={blocked}
              onChange={(e) =>
                setWord(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))
              }
            />
          </label>
          <div className="actions">
            <button
              className="quiet"
              type="button"
              disabled={blocked || !word}
              onClick={() => setWord(word.slice(0, -1))}
            >
              Delete letter
            </button>
            <button
              className="quiet"
              type="button"
              disabled={blocked}
              onClick={() => setOuter(shuffle(outer, Math.random))}
            >
              Shuffle letters
            </button>
            <button className="primary" disabled={blocked || word.length < 4}>
              Submit word
            </button>
          </div>
        </form>
      )}
      <details className="help-card" open>
        <summary>
          Found words ({state.words.length} of {puzzle.words.length})
        </summary>
        <p className="challenge-word-list">
          {[...state.words].sort().join(' · ') ||
            'Your accepted words will appear here.'}
        </p>
      </details>
    </>
  );
}
