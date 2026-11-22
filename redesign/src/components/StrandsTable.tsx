import { useEffect, useRef, useState } from 'react';
import type { StrandsState } from '../lib/strands.ts';
import { strandsDone, strandsPuzzle } from '../lib/strands.ts';
export function StrandsTable({
  state,
  blocked,
  action,
}: {
  state: StrandsState;
  blocked: boolean;
  action: (input: unknown) => void;
}) {
  const [path, setPath] = useState<number[]>([]),
    [message, setMessage] = useState('');
  const dragging = useRef(false);
  const dragged = useRef(false);
  const puzzle = strandsPuzzle(state.seed),
    done = strandsDone(state);
  useEffect(() => {
    setPath([]);
    setMessage('');
  }, [state.seed, state.found.length]);
  const used = state.found.flatMap((f) => f.path),
    spangram = state.found.find((f) => f.word === 0)?.path ?? [];
  function select(cell: number) {
    if (path.at(-1) === cell) {
      setPath(path.slice(0, -1));
      return;
    }
    if (path.includes(cell)) {
      setMessage('Use each letter once. Tap the last letter to undo.');
      return;
    }
    const last = path.at(-1);
    if (
      last !== undefined &&
      (Math.abs(Math.floor(last / 6) - Math.floor(cell / 6)) > 1 ||
        Math.abs((last % 6) - (cell % 6)) > 1)
    ) {
      setMessage('Choose a touching letter.');
      return;
    }
    setPath([...path, cell]);
    setMessage('');
  }
  return (
    <>
      <div className="strands-theme-card">
        <p>{state.date ? 'TODAY’S THEME' : 'PUZZLE THEME'}</p>
        <h3 className="strands-theme">{puzzle.theme}</h3>
      </div>
      <p className="challenge-draft" aria-live="polite">
        {path.length
          ? path.map((n) => puzzle.letters[n]).join('')
          : done
            ? 'Well done!'
            : '\u00a0'}
      </p>
      <div className="strands-board">
        <svg
          className="strands-paths"
          viewBox="0 0 600 800"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {[
            ...state.found.map((found) => ({
              path: found.path,
              kind: found.word === 0 ? 'span-line' : 'found-line',
            })),
            { path, kind: 'active-line' },
          ].map((trace, index) => (
            <polyline
              pathLength={1}
              key={index}
              className={trace.kind}
              points={trace.path
                .map(
                  (cell) =>
                    `${(cell % 6) * 100 + 50},${Math.floor(cell / 6) * 100 + 50}`,
                )
                .join(' ')}
            />
          ))}
        </svg>
        <div
          className="strands-grid"
          onPointerDown={(e) => {
            const button = (e.target as HTMLElement).closest<HTMLButtonElement>(
              'button[data-cell]',
            );
            if (!button || button.disabled) return;
            dragging.current = true;
            dragged.current = false;
            e.currentTarget.setPointerCapture(e.pointerId);
            select(Number(button.dataset.cell));
          }}
          onPointerMove={(e) => {
            if (!dragging.current) return;
            const button = document
              .elementFromPoint(e.clientX, e.clientY)
              ?.closest<HTMLButtonElement>('button[data-cell]');
            if (!button || !e.currentTarget.contains(button) || button.disabled)
              return;
            const cell = Number(button.dataset.cell);
            if (cell === path.at(-1)) return;
            dragged.current = true;
            if (!path.includes(cell)) select(cell);
          }}
          onPointerUp={() => {
            dragging.current = false;
            if (dragged.current && path.length >= 3)
              action({ type: 'word', path });
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
          role="group"
          aria-label="Letter grid"
          onKeyDown={(e) => {
            const n = {
              ArrowRight: 1,
              ArrowLeft: -1,
              ArrowDown: 6,
              ArrowUp: -6,
            }[e.key];
            if (n === undefined) return;
            const buttons = [
              ...e.currentTarget.querySelectorAll<HTMLButtonElement>('button'),
            ];
            const i = buttons.indexOf(e.target as HTMLButtonElement);
            if (i < 0) return;
            e.preventDefault();
            for (let step = 1; step <= 48; step++) {
              const button = buttons[(i + n * step + 48 * 48) % 48];
              if (!button.disabled) {
                button.focus();
                break;
              }
            }
          }}
        >
          {puzzle.letters.map((letter, cell) => (
            <button
              className={`${used.includes(cell) ? 'found' : ''} ${spangram.includes(cell) ? 'spangram' : ''} ${state.hints.some((word) => !state.found.some((f) => f.word === word) && puzzle.paths[word][0] === cell) ? 'hinted' : ''}`}
              key={cell}
              data-cell={cell}
              aria-label={`${letter}, row ${Math.floor(cell / 6) + 1} column ${(cell % 6) + 1}${used.includes(cell) ? ', found' : ''}`}
              aria-pressed={path.includes(cell)}
              disabled={blocked || done || used.includes(cell)}
              onClick={(e) => {
                if (e.detail === 0) select(cell);
              }}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>
      {!done && (
        <>
          <div className="strands-progress">
            <button
              className="quiet"
              disabled={blocked || state.hints.length >= 3}
              onClick={() => action({ type: 'hint' })}
            >
              Hint ({3 - state.hints.length})
            </button>
            <p>
              <strong>{state.found.length}</strong> of {puzzle.words.length}{' '}
              found
            </p>
          </div>
          <div className="actions strands-secondary">
            <button
              className="quiet"
              aria-label="Clear path"
              disabled={blocked || !path.length}
              onClick={() => setPath([])}
            >
              Clear
            </button>
            <button
              className="primary"
              aria-label="Submit word"
              disabled={blocked || path.length < 3}
              onClick={() => action({ type: 'word', path })}
            >
              Submit
            </button>
          </div>
        </>
      )}
      <p role="status">{message}</p>
      <ul className="strands-found" aria-label="Found words">
        {state.found.map((f) => (
          <li key={f.word}>
            {puzzle.words[f.word]}
            {f.word === 0 ? ' · Spangram' : ''}
          </li>
        ))}
      </ul>
    </>
  );
}
