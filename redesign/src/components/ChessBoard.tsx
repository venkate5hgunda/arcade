import { useState } from 'react';
import {
  chessPieceMarkup,
  sqName,
  PIECE_NAMES,
  PROMO_CHOICES,
  generateLegalMoves,
} from '../lib/chess.ts';
import type { ChessState, Color, PieceType } from '../lib/chess.ts';
export function ChessBoard({
  game,
  blocked,
  flip,
  onMove,
}: {
  game: ChessState;
  blocked: boolean;
  flip: boolean;
  onMove: (from: number, to: number, promotion?: PieceType) => void;
}) {
  const [selection, setSelection] = useState<{
    board: ChessState['state']['board'];
    sq: number;
  } | null>(null);
  const selected = selection?.board === game.state.board ? selection.sq : null;
  const legal =
    selected === null
      ? []
      : generateLegalMoves(game.state, game.state.turn).filter(
          (m) => m.from === selected,
        );
  const squares = Array.from({ length: 64 }, (_, i) =>
    flip
      ? Math.floor(i / 8) * 8 + 7 - (i % 8)
      : (7 - Math.floor(i / 8)) * 8 + (i % 8),
  );
  const names: Record<Color, string> = { w: 'White', b: 'Black' };
  return (
    <>
      {game.pendingPromotion && (
        <div
          className="chess-promotion"
          role="group"
          aria-label="Choose promotion"
        >
          <p>Promote your pawn:</p>
          {PROMO_CHOICES.map((type) => (
            <button
              className="quiet"
              key={type}
              disabled={blocked}
              onClick={() =>
                onMove(
                  game.pendingPromotion!.from,
                  game.pendingPromotion!.to,
                  type,
                )
              }
            >
              Promote to {PIECE_NAMES[type]}
            </button>
          ))}
        </div>
      )}
      <div
        className="chess-board"
        role="group"
        aria-label="Chess board"
        onKeyDown={(e) => {
          const delta: Record<string, number> = {
            ArrowRight: 1,
            ArrowLeft: -1,
            ArrowDown: 8,
            ArrowUp: -8,
          };
          if (!(e.key in delta)) return;
          const buttons = Array.from(
            e.currentTarget.querySelectorAll<HTMLButtonElement>('button'),
          );
          const index = buttons.indexOf(e.target as HTMLButtonElement);
          if (index < 0) return;
          e.preventDefault();
          buttons[Math.max(0, Math.min(63, index + delta[e.key]))].focus();
        }}
      >
        {squares.map((sq) => {
          const p = game.state.board[sq],
            target = legal.find((m) => m.to === sq);
          return (
            <button
              key={sq}
              className={`chess-square ${(Math.floor(sq / 8) + (sq % 8)) % 2 ? 'chess-light' : 'chess-dark'} ${selected === sq ? 'chess-selected' : ''} ${target ? 'chess-target' : ''} ${game.lastMove && [game.lastMove.from, game.lastMove.to].includes(sq) ? 'chess-last' : ''}`}
              aria-label={`${sqName(sq)}${p ? `, ${names[p.color]} ${PIECE_NAMES[p.type]}` : ', empty'}${target ? ', legal move' : ''}`}
              aria-pressed={selected === sq}
              aria-disabled={blocked || game.over || !!game.pendingPromotion}
              onClick={() => {
                if (blocked || game.over || game.pendingPromotion) return;
                if (target && selected !== null) {
                  onMove(selected, sq);
                  setSelection(null);
                } else
                  setSelection(
                    p?.color === game.state.turn
                      ? { board: game.state.board, sq }
                      : null,
                  );
              }}
            >
              <small aria-hidden="true">{sqName(sq)}</small>
              {p && (
                <span
                  dangerouslySetInnerHTML={{
                    __html: chessPieceMarkup(p.type, p.color),
                  }}
                />
              )}
              {target && <i aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="chess-captures" aria-label="Captured pieces">
        {(['w', 'b'] as const).map((color) => (
          <p key={color}>
            {names[color]} captured:{' '}
            {game.captured[color].map((type) => PIECE_NAMES[type]).join(', ') ||
              'none'}
          </p>
        ))}
      </div>
    </>
  );
}
