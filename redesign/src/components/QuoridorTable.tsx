import { useEffect, useRef, useState } from 'react';
import {
  quoridorMoves,
  quoridorStock,
  quoridorWallError,
} from '../lib/quoridor.ts';
import type { QuoridorState, QuoridorWall } from '../lib/quoridor.ts';
function Wall({
  wall,
  preview = false,
}: {
  wall: QuoridorWall;
  preview?: boolean;
}) {
  const horizontal = wall.orientation === 'h';
  return (
    <span
      className={`quoridor-wall wall-owner-${wall.owner} ${preview ? 'preview' : ''}`}
      aria-hidden="true"
      style={{
        left: `calc(${((horizontal ? wall.col : wall.col + 1) / 9) * 100}% ${horizontal ? '+ 2px' : '- 2px'})`,
        top: `calc(${((horizontal ? wall.row + 1 : wall.row) / 9) * 100}% ${horizontal ? '- 2px' : '+ 2px'})`,
        width: horizontal ? 'calc(22.222% - 2px)' : '4px',
        height: horizontal ? '4px' : 'calc(22.222% - 2px)',
      }}
    />
  );
}
export function QuoridorTable({
  state,
  blocked,
  action,
}: {
  state: QuoridorState;
  blocked: boolean;
  action: (input: unknown) => void;
}) {
  const [mode, setMode] = useState<'move' | 'h' | 'v'>('move'),
    [anchor, setAnchor] = useState<number | null>(null);
  const grid = useRef<HTMLDivElement>(null),
    moves = quoridorMoves(state),
    done = state.winner !== null;
  useEffect(
    () => setAnchor(null),
    [state.seed, state.current, state.walls.length],
  );
  const preview =
    anchor === null
      ? null
      : {
          row: Math.floor(anchor / 9),
          col: anchor % 9,
          orientation: mode === 'v' ? ('v' as const) : ('h' as const),
          owner: state.current,
        };
  const error = preview ? quoridorWallError(state, preview) : null;
  return (
    <>
      <div className="quoridor-scores">
        <span>Player 1 · Coral · {quoridorStock(state, 0)} walls</span>
        <span>Player 2 · Teal · {quoridorStock(state, 1)} walls</span>
      </div>
      <p className="challenge-edition">
        {done
          ? `Player ${state.winner! + 1} wins!`
          : `Player ${state.current + 1}’s turn · Goal: ${state.current === 0 ? 'bottom' : 'top'} edge`}
      </p>
      {!done && (
        <div
          className="actions quoridor-modes"
          role="group"
          aria-label="Choose your action"
        >
          {(['move', 'h', 'v'] as const).map((value) => (
            <button
              className="quiet"
              key={value}
              aria-pressed={mode === value}
              disabled={blocked}
              onClick={() => {
                setMode(value);
                setAnchor(null);
              }}
            >
              {value === 'move'
                ? 'Move pawn'
                : value === 'h'
                  ? 'Horizontal wall'
                  : 'Vertical wall'}
            </button>
          ))}
        </div>
      )}
      <div className="quoridor-board">
        <div
          className="quoridor-grid"
          ref={grid}
          role="group"
          aria-label="Quoridor board"
          onKeyDown={(e) => {
            const step = {
              ArrowRight: 1,
              ArrowLeft: -1,
              ArrowDown: 9,
              ArrowUp: -9,
            }[e.key];
            if (step === undefined) return;
            const buttons = [
                ...e.currentTarget.querySelectorAll<HTMLButtonElement>(
                  'button',
                ),
              ],
              i = buttons.indexOf(e.target as HTMLButtonElement);
            if (i < 0) return;
            e.preventDefault();
            for (let n = 1; n <= 81; n++) {
              const next = buttons[(i + step * n + 81 * 81) % 81];
              if (!next.disabled) {
                next.focus();
                break;
              }
            }
          }}
        >
          {Array.from({ length: 81 }, (_, cell) => {
            const player = state.pawns.indexOf(cell);
            return (
              <button
                key={cell}
                className={`${mode === 'move' && moves.includes(cell) ? 'legal' : ''} ${anchor === cell ? 'anchor' : ''}`}
                disabled={
                  blocked ||
                  done ||
                  (mode !== 'move' &&
                    (Math.floor(cell / 9) === 8 || cell % 9 === 8))
                }
                aria-label={`Row ${Math.floor(cell / 9) + 1} column ${(cell % 9) + 1}${player >= 0 ? `, Player ${player + 1}` : ''}${mode === 'move' && moves.includes(cell) ? ', legal move' : ''}${mode !== 'move' ? ', wall anchor' : ''}`}
                onClick={() =>
                  mode === 'move'
                    ? action({ type: 'move', cell })
                    : setAnchor(cell)
                }
              >
                {player >= 0 && (
                  <span
                    className={`quoridor-pawn pawn-${player}`}
                    aria-hidden="true"
                  >
                    {player + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {state.walls.map((wall, i) => (
          <Wall key={i} wall={wall} />
        ))}
        {preview && <Wall wall={preview} preview />}
      </div>
      {mode !== 'move' && !done && (
        <>
          <p role="status">
            {anchor === null
              ? 'Choose the upper-left square of the two-space wall.'
              : error || 'Preview ready. Confirm to place this wall.'}
          </p>
          <div className="actions">
            <button
              className="primary"
              disabled={blocked || !preview || !!error}
              onClick={() => {
                if (preview) action({ type: 'wall', ...preview });
                setAnchor(null);
              }}
            >
              Place wall
            </button>
            <button
              className="quiet"
              disabled={blocked || anchor === null}
              onClick={() => setAnchor(null)}
            >
              Cancel wall
            </button>
          </div>
        </>
      )}
      <p>
        Move one square or place a wall. Jump the other pawn when possible;
        sidestep only when a straight jump is blocked. Both players must always
        keep a route to the opposite edge.
      </p>
    </>
  );
}
