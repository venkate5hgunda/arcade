import { useRef } from 'react';
import { findWin } from '../lib/tictactoe.ts';
import type { Board as Cells } from '../lib/tictactoe.ts';
export function Board({
  board,
  blocked,
  move,
}: {
  board: Cells;
  blocked: boolean;
  move: (cell: number) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const line = findWin(board);
  return (
    <div className="ttt-board" role="group" aria-label="Tic-Tac-Toe board">
      {board.map((cell, index) => (
        <button
          ref={(el) => {
            refs.current[index] = el;
          }}
          key={index}
          className={`square ${cell === 1 ? 'x' : 'o'} ${line?.includes(index) ? 'winning' : ''}`}
          aria-label={`Row ${Math.floor(index / 3) + 1}, column ${(index % 3) + 1}: ${cell === 1 ? 'X' : cell === 2 ? 'O' : 'empty'}`}
          aria-disabled={blocked || !!cell}
          onClick={() => {
            if (!blocked && !cell) move(index);
          }}
          onKeyDown={(event) => {
            const delta: Record<string, number> = {
              ArrowRight: 1,
              ArrowLeft: -1,
              ArrowDown: 3,
              ArrowUp: -3,
            };
            if (event.key in delta) {
              event.preventDefault();
              refs.current[(index + delta[event.key] + 9) % 9]?.focus();
            }
            if (event.key === 'Home' || event.key === 'End') {
              event.preventDefault();
              refs.current[event.key === 'Home' ? 0 : 8]?.focus();
            }
          }}
        >
          {cell === 1 ? (
            'X'
          ) : cell === 2 ? (
            'O'
          ) : (
            <span className="sr-only">Place mark</span>
          )}
        </button>
      ))}
    </div>
  );
}
