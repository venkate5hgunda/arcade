import { useEffect, useRef, useState } from 'react';
import { miniDone, miniPuzzle } from '../lib/mini.ts';
import type { MiniState } from '../lib/mini.ts';
export function MiniTable({
  state,
  blocked,
  action,
}: {
  state: MiniState;
  blocked: boolean;
  action: (input: unknown) => void;
}) {
  const [selected, setSelected] = useState(0),
    [direction, setDirection] = useState<'across' | 'down'>('across'),
    [checked, setChecked] = useState(false);
  const grid = useRef<HTMLDivElement>(null),
    puzzle = miniPuzzle(state.seed),
    done = miniDone(state);
  useEffect(() => {
    setSelected(0);
    setChecked(false);
  }, [state.seed]);
  const clueIndex =
      direction === 'across' ? Math.floor(selected / 5) : selected % 5,
    clue = puzzle[direction][clueIndex];
  function focus(cell: number) {
    const next = (cell + 25) % 25;
    setSelected(next);
    grid.current?.querySelectorAll<HTMLInputElement>('input')[next]?.focus();
  }
  return (
    <>
      <p className="challenge-edition">
        {state.date ? `Daily · ${state.date}` : 'Practice'} ·{' '}
        {state.entries.filter(Boolean).length}/25 letters ·{' '}
        {state.revealed.length} revealed
      </p>
      <p className="mini-current" aria-live="polite">
        {direction === 'across' ? 'Across' : 'Down'} {clue.number}: {clue.clue}
      </p>
      <div
        className="mini-grid"
        role="group"
        aria-label="Mini crossword grid"
        ref={grid}
      >
        {state.entries.map((value, cell) => {
          const number =
            cell < 5
              ? cell + 1
              : cell % 5 === 0
                ? Math.floor(cell / 5) + 5
                : null;
          return (
            <div
              className={`mini-cell ${selected === cell ? 'selected' : ''} ${checked && value && value !== puzzle.answer[cell] ? 'incorrect' : ''} ${state.revealed.includes(cell) ? 'revealed' : ''}`}
              key={cell}
            >
              {number !== null && <span aria-hidden="true">{number}</span>}
              <input
                aria-label={`Row ${Math.floor(cell / 5) + 1} column ${(cell % 5) + 1}${state.revealed.includes(cell) ? ', revealed' : ''}`}
                value={value}
                maxLength={1}
                disabled={blocked || done}
                readOnly={state.revealed.includes(cell)}
                autoComplete="off"
                autoCapitalize="characters"
                onFocus={(e) => {
                  setSelected(cell);
                  e.currentTarget.select();
                }}
                onClick={() => {
                  if (selected === cell)
                    setDirection(direction === 'across' ? 'down' : 'across');
                }}
                onChange={(e) => {
                  const letter = e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z]/g, '')
                    .slice(-1);
                  action({ type: 'entry', cell, value: letter });
                  if (letter) focus(cell + (direction === 'across' ? 1 : 5));
                }}
                onKeyDown={(e) => {
                  const step = {
                    ArrowRight: 1,
                    ArrowLeft: -1,
                    ArrowDown: 5,
                    ArrowUp: -5,
                  }[e.key];
                  if (step !== undefined) {
                    e.preventDefault();
                    setDirection(step === 1 || step === -1 ? 'across' : 'down');
                    focus(cell + step);
                  } else if (e.key === 'Backspace' && !value) {
                    e.preventDefault();
                    focus(cell - (direction === 'across' ? 1 : 5));
                  }
                }}
              />
            </div>
          );
        })}
      </div>
      {!done && (
        <div className="actions">
          <button
            className="quiet"
            disabled={blocked}
            onClick={() =>
              setDirection(direction === 'across' ? 'down' : 'across')
            }
          >
            Switch direction
          </button>
          <button
            className="quiet"
            disabled={blocked}
            onClick={() => setChecked(!checked)}
            aria-pressed={checked}
          >
            Check letters
          </button>
          <button
            className="quiet"
            disabled={blocked || state.revealed.includes(selected)}
            onClick={() => action({ type: 'reveal', cell: selected })}
          >
            Reveal letter
          </button>
        </div>
      )}
      {checked && (
        <p role="status">
          {state.entries.filter((v, i) => v && v !== puzzle.answer[i]).length}{' '}
          filled letters need another look.
        </p>
      )}
      <div className="mini-clues">
        {(['across', 'down'] as const).map((dir) => (
          <section key={dir}>
            <h3>{dir === 'across' ? 'Across' : 'Down'}</h3>
            <ol>
              {puzzle[dir].map((c, i) => (
                <li key={c.number}>
                  <button
                    className="mini-clue"
                    disabled={blocked || done}
                    onClick={() => {
                      setDirection(dir);
                      focus(dir === 'across' ? i * 5 : i);
                    }}
                  >
                    {c.number}. {c.clue}
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </>
  );
}
