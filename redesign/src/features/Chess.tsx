import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Frame, useRun } from '../components/GameFrame.tsx';
import { ChessBoard } from '../components/ChessBoard.tsx';
import {
  newChess,
  validChess,
  chessResult,
  moveChess,
  pickAiMove,
} from '../lib/chess.ts';
import type { ChessState, Color, PieceType } from '../lib/chess.ts';
import { names as readNames } from '../lib/profile.ts';
export function ChessGame() {
  const run = useRun<ChessState>(
    'chess',
    { mode: 'pvp', side: 'w' },
    validChess,
    (s) => newChess(s.mode === 'ai' ? 'ai' : 'pvp', s.side === 'b' ? 'b' : 'w'),
  );
  const s = run.state,
    result = s ? chessResult(s) : null;
  const [names] = useState(readNames);
  const label = (color: Color) =>
    s?.mode === 'ai' && color !== s.side
      ? 'Computer'
      : names[color === 'w' ? 0 : 1] || (color === 'w' ? 'White' : 'Black');
  const aiTurn = !!s && !s.over && s.mode === 'ai' && s.state.turn !== s.side;
  useEffect(() => {
    if (s) run.setSettings({ mode: s.mode, side: s.side });
  }, []);
  useEffect(() => {
    if (!s || !aiTurn) return;
    const timer = setTimeout(() => {
      const m = pickAiMove(s.state, s.state.turn);
      if (m) {
        const next = moveChess(s, m.from, m.to, m.promotionPiece);
        if (next) run.commit(next);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [s, aiTurn]);
  function move(from: number, to: number, promotion?: PieceType) {
    if (!s || aiTurn) return;
    const next = moveChess(s, from, to, promotion);
    if (next) run.commit(next);
  }
  return (
    <Frame
      run={run}
      fields={[
        {
          key: 'mode',
          label: 'Opponent',
          options: [
            ['pvp', 'Friend (pass & play)'],
            ['ai', 'Computer'],
          ],
        },
        {
          key: 'side',
          label: 'Play as',
          options: [
            ['w', 'White'],
            ['b', 'Black'],
          ],
        },
      ]}
      summary="A thoughtful move. A whole new possibility."
      title={
        s?.over
          ? result?.winner
            ? `Checkmate! ${label(result.winner)} wins!`
            : 'Draw!'
          : s?.pendingPromotion
            ? 'Choose a promotion'
            : aiTurn
              ? 'Computer is thinking…'
              : `${s ? label(s.state.turn) : 'White'} to move${result?.check ? ' — Check!' : ''}`
      }
      status={
        s?.over
          ? result?.winner
            ? 'The king has no safe move.'
            : result && !generateCount(s)
              ? 'Stalemate — no legal moves.'
              : 'Draw — insufficient material.'
          : s?.pendingPromotion
            ? 'Choose queen, rook, bishop or knight before play continues.'
            : 'Select a piece, then a highlighted square.'
      }
      help="White moves first. Select a piece to see its legal moves; select a highlighted square to move. Castling requires a clear, safe path. En passant is available immediately after an adjacent pawn advances two squares. Pawns promote to your choice of queen, rook, bishop or knight. Checkmate wins; stalemate and insufficient material draw. Use arrow keys and Enter or Space on the board."
      setupExtra={
        <Link className="room-callout" to="/room">
          Different screens? Start a private room →
        </Link>
      }
      after={
        s?.over && (
          <button className="primary" onClick={run.start}>
            Play again
          </button>
        )
      }
    >
      {s && (
        <ChessBoard
          game={s}
          blocked={aiTurn}
          flip={s.mode === 'ai' ? s.side === 'b' : s.state.turn === 'b'}
          onMove={move}
        />
      )}
    </Frame>
  );
}
import { generateLegalMoves } from '../lib/chess.ts';
function generateCount(s: ChessState) {
  return generateLegalMoves(s.state, s.state.turn).length;
}
