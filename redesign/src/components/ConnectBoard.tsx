import { c4Row, c4Win } from '../lib/puzzles.ts';
import type { LocalState } from '../lib/tictactoe.ts';
export function ConnectBoard({
  state,
  blocked,
  drop,
}: {
  state: LocalState;
  blocked: boolean;
  drop: (column: number) => void;
}) {
  const win = c4Win(state.board);
  return (
    <div className="connect-board" role="group" aria-label="Connect Four board">
      <div className="connect-columns">
        {Array.from({ length: 7 }, (_, column) => (
          <button
            key={column}
            disabled={blocked || c4Row(state.board, column) < 0}
            aria-label={`Drop in column ${column + 1}`}
            onClick={() => drop(column)}
          >
            ↓
          </button>
        ))}
      </div>
      <div className="connect-grid">
        {state.board.map((value, index) => (
          <div
            key={index}
            className={`connect-slot token-${value} ${win?.includes(index) ? 'winning' : ''}`}
            role="img"
            aria-label={`Row ${Math.floor(index / 7) + 1}, column ${(index % 7) + 1}: ${value === 1 ? 'red' : value === 2 ? 'gold' : 'empty'}`}
          >
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}
