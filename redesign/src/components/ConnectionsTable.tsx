import { useEffect, useRef, useState } from 'react';
import {
  connectionsProgress,
  connectionsPuzzle,
  guessGroup,
  submitConnections,
} from '../lib/connections.ts';
import type { ConnectionsState } from '../lib/connections.ts';

function shuffled() {
  const words = Array.from({ length: 16 }, (_, i) => i);
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  return words;
}

/** Selections and shuffling are private UI; only submitted guesses are shared. */
export function ConnectionsTable({
  game,
  blocked = false,
  submit,
}: {
  game: ConnectionsState;
  blocked?: boolean;
  submit: (words: number[]) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [feedback, setFeedback] = useState('');
  const [order, setOrder] = useState(shuffled);
  const grid = useRef<HTMLDivElement>(null);
  const { solved, mistakes, won, over } = connectionsProgress(game);
  const puzzle = connectionsPuzzle(game);
  const words = puzzle.groups.flatMap((group) => group.words);
  useEffect(() => {
    setSelected([]);
    const last = game.guesses.at(-1);
    setFeedback(
      last
        ? submitConnections(
            { ...game, guesses: game.guesses.slice(0, -1) },
            last,
          ).message
        : '',
    );
  }, [game.puzzleId, game.guesses.length]);
  useEffect(() => {
    setOrder(shuffled());
  }, [game.puzzleId]);
  return (
    <div className="connections-table">
      <p className="connections-edition">
        {game.date ? `Daily puzzle · ${game.date}` : 'Practice puzzle'} ·{' '}
        {over
          ? won
            ? 'All connected!'
            : 'Answers revealed'
          : `${4 - mistakes} mistakes remaining`}
      </p>
      <div
        className="connections-groups"
        role="group"
        aria-label="Solved connections"
      >
        {(over
          ? [...solved, ...[0, 1, 2, 3].filter((g) => !solved.includes(g))]
          : solved
        ).map((g) => (
          <section
            className={`connections-group connections-color-${g}`}
            key={g}
          >
            <h3>
              {puzzle.groups[g].name}
              {!solved.includes(g) && <span> · Not found</span>}
            </h3>
            <p>{puzzle.groups[g].words.join(', ')}</p>
          </section>
        ))}
      </div>
      {!over && (
        <>
          <p id="connections-instructions">
            Select four words with something in common.
          </p>
          <div
            className="connections-grid"
            ref={grid}
            role="group"
            aria-label="Word tiles"
            aria-describedby="connections-instructions"
            onKeyDown={(event) => {
              const offset = {
                ArrowRight: 1,
                ArrowLeft: -1,
                ArrowDown: 4,
                ArrowUp: -4,
              }[event.key];
              if (offset === undefined) return;
              const buttons = [
                ...(grid.current?.querySelectorAll<HTMLButtonElement>(
                  'button',
                ) ?? []),
              ];
              const index = buttons.indexOf(event.target as HTMLButtonElement);
              if (index < 0) return;
              event.preventDefault();
              buttons[
                (index + offset + buttons.length) % buttons.length
              ]?.focus();
            }}
          >
            {order
              .filter((word) => !solved.includes(Math.floor(word / 4)))
              .map((word) => (
                <button
                  key={word}
                  type="button"
                  className="connections-word"
                  aria-pressed={selected.includes(word)}
                  disabled={blocked}
                  onClick={() => {
                    setSelected((current) =>
                      current.includes(word)
                        ? current.filter((w) => w !== word)
                        : current.length < 4
                          ? [...current, word]
                          : current,
                    );
                  }}
                >
                  {words[word]}
                </button>
              ))}
          </div>
          <div className="actions connections-actions">
            <button
              className="quiet"
              disabled={blocked}
              onClick={() => setOrder(shuffled())}
            >
              Shuffle
            </button>
            <button
              className="quiet"
              disabled={blocked || !selected.length}
              onClick={() => setSelected([])}
            >
              Deselect all
            </button>
            <button
              className="primary"
              disabled={blocked || selected.length !== 4}
              onClick={() => {
                const result = submitConnections(game, selected);
                setFeedback(result.message);
                if (result.state !== game) submit(selected);
              }}
            >
              Submit group
            </button>
          </div>
          <p className="count">{selected.length} of 4 selected</p>
        </>
      )}
      <p className="connections-message" role="status">
        {feedback}
      </p>
      {game.guesses.length > 0 && (
        <details className="help-card connections-history">
          <summary>Guess history ({game.guesses.length})</summary>
          <ol>
            {game.guesses.map((guess, i) => (
              <li key={i}>
                {guess.map((w) => words[w]).join(', ')} —{' '}
                {guessGroup(guess) === null
                  ? 'Not a group'
                  : 'Connection found'}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
