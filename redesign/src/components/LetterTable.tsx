import { useEffect, useState } from 'react';
import { letterDone, letterPuzzle, letterUsed } from '../lib/letter-boxed.ts';
import type { LetterState } from '../lib/letter-boxed.ts';
export function LetterTable({
  state,
  blocked,
  action,
}: {
  state: LetterState;
  blocked: boolean;
  action: (input: unknown) => void;
}) {
  const puzzle = letterPuzzle(state.seed),
    used = letterUsed(state),
    done = letterDone(state),
    last = state.words.at(-1)?.at(-1) ?? '';
  const [input, setInput] = useState(last);
  useEffect(() => {
    setInput(last);
  }, [state.seed, state.words.length, last]);
  return (
    <>
      <p className="challenge-edition">
        {state.date ? `Daily · ${state.date}` : 'Practice'} · {used.size} of 12
        letters · {state.words.length} words
      </p>
      <div
        className="letter-square"
        role="group"
        aria-label="Letters around the square"
      >
        {puzzle.sides.map((side, i) => (
          <div
            className={`letter-side letter-side-${i}`}
            key={i}
            aria-label={`Side ${i + 1}`}
            role="group"
          >
            {[...side].map((letter) => (
              <button
                className={used.has(letter) ? 'used' : ''}
                key={letter}
                disabled={blocked || done}
                aria-label={`${letter}, side ${i + 1}${used.has(letter) ? ', used' : ''}`}
                onClick={() =>
                  setInput((value) => (value + letter).slice(0, 40))
                }
              >
                {letter}
              </button>
            ))}
          </div>
        ))}
        <span className="letter-square-center" aria-hidden="true">
          {used.size}/12
        </span>
      </div>
      {!done && (
        <form
          className="challenge-form"
          onSubmit={(e) => {
            e.preventDefault();
            action({ type: 'word', word: input });
          }}
        >
          <label>
            Chain word{last ? ` · start with ${last}` : ''}
            <input
              aria-label="Chain word"
              autoComplete="off"
              maxLength={40}
              value={input}
              disabled={blocked}
              onChange={(e) =>
                setInput(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))
              }
            />
          </label>
          <div className="actions">
            <button
              type="button"
              className="quiet"
              disabled={blocked}
              onClick={() => setInput(last)}
            >
              Clear word
            </button>
            <button
              type="button"
              className="quiet"
              disabled={blocked || !state.words.length}
              onClick={() => action({ type: 'undo' })}
            >
              Undo word
            </button>
            <button className="primary" disabled={blocked || input.length < 3}>
              Submit word
            </button>
          </div>
        </form>
      )}
      <ol className="letter-chain" aria-label="Word chain">
        {state.words.map((word, i) => (
          <li key={i}>{word}</li>
        ))}
      </ol>
      <p>
        Try to cover the square in two words. Any complete legal chain wins.
      </p>
    </>
  );
}
