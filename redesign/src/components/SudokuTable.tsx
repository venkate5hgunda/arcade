import { useEffect, useRef, useState } from 'react';
import type { SudokuState } from '../lib/sudoku.ts';
import { sudokuConflicts, sudokuDone, sudokuPuzzle } from '../lib/sudoku.ts';
export function SudokuTable({
  state,
  blocked,
  action,
}: {
  state: SudokuState;
  blocked: boolean;
  action: (input: unknown) => void;
}) {
  const [selected, setSelected] = useState(0),
    [notes, setNotes] = useState(false);
  const grid = useRef<HTMLDivElement>(null),
    p = sudokuPuzzle(state.seed, state.difficulty),
    conflicts = sudokuConflicts(state),
    done = sudokuDone(state),
    fixed = !!p.givens[selected] || state.revealed.includes(selected);
  useEffect(
    () =>
      setSelected(
        sudokuPuzzle(state.seed, state.difficulty).givens.findIndex((n) => !n),
      ),
    [state.seed, state.difficulty],
  );
  function enter(n: number) {
    action({ type: notes && n ? 'note' : 'entry', cell: selected, value: n });
  }
  return (
    <>
      <p className="challenge-edition">
        {state.date ? `Daily · ${state.date}` : 'Practice'} · {state.difficulty}{' '}
        · {state.values.filter(Boolean).length}/81 filled ·{' '}
        {state.revealed.length} revealed
      </p>
      <div
        className="sudoku-grid"
        role="group"
        aria-label="Sudoku grid"
        ref={grid}
        onKeyDown={(e) => {
          const step = {
            ArrowRight: 1,
            ArrowLeft: -1,
            ArrowDown: 9,
            ArrowUp: -9,
          }[e.key];
          if (step !== undefined) {
            e.preventDefault();
            const next = (selected + step + 81) % 81;
            setSelected(next);
            grid.current
              ?.querySelectorAll<HTMLButtonElement>('button')
              [next]?.focus();
          } else if (/^[1-9]$/.test(e.key) && !blocked && !done && !fixed) {
            e.preventDefault();
            enter(Number(e.key));
          } else if (
            (e.key === 'Backspace' || e.key === 'Delete') &&
            !blocked &&
            !done &&
            !fixed
          ) {
            e.preventDefault();
            enter(0);
          }
        }}
      >
        {state.values.map((n, cell) => (
          <button
            key={cell}
            aria-label={`Row ${Math.floor(cell / 9) + 1} column ${(cell % 9) + 1}, ${n || 'empty'}${p.givens[cell] ? ', given' : ''}${state.revealed.includes(cell) ? ', revealed' : ''}${state.notes[cell].length ? ', notes ' + state.notes[cell].join(', ') : ''}${conflicts.includes(cell) ? ', conflict' : ''}`}
            aria-pressed={cell === selected}
            disabled={blocked || done}
            className={`${cell % 9 === 2 || cell % 9 === 5 ? 'box-right' : ''} ${Math.floor(cell / 9) === 2 || Math.floor(cell / 9) === 5 ? 'box-bottom' : ''} ${p.givens[cell] ? 'given' : ''} ${selected === cell ? 'selected' : ''} ${conflicts.includes(cell) ? 'conflict' : ''}`}
            onClick={() => setSelected(cell)}
          >
            {n || (
              <span className="sudoku-notes">
                {Array.from({ length: 9 }, (_, i) => (
                  <small key={i}>
                    {state.notes[cell].includes(i + 1) ? i + 1 : ''}
                  </small>
                ))}
              </span>
            )}
          </button>
        ))}
      </div>
      {!done && (
        <>
          <p>
            {fixed
              ? 'This cell is fixed. Choose an empty cell.'
              : `Selected row ${Math.floor(selected / 9) + 1}, column ${(selected % 9) + 1}`}
          </p>
          <div
            className="sudoku-keypad"
            role="group"
            aria-label="Enter a digit"
          >
            {Array.from({ length: 9 }, (_, i) => (
              <button
                key={i}
                className="quiet"
                disabled={blocked || fixed}
                onClick={() => enter(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="actions">
            <button
              className="quiet"
              aria-pressed={notes}
              disabled={blocked}
              onClick={() => setNotes(!notes)}
            >
              Pencil notes {notes ? 'on' : 'off'}
            </button>
            <button
              className="quiet"
              disabled={blocked || fixed}
              onClick={() => enter(0)}
            >
              Erase cell
            </button>
            <button
              className="quiet"
              disabled={blocked || fixed}
              onClick={() => action({ type: 'hint', cell: selected })}
            >
              Reveal cell
            </button>
          </div>
        </>
      )}
      <p role="status">
        {conflicts.length
          ? `${conflicts.length} cells conflict with a row, column or box.`
          : 'No row, column or box conflicts.'}
      </p>
    </>
  );
}
