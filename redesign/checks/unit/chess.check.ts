import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  newChess,
  validChess,
  generateLegalMoves,
  initialState,
  moveChess,
  chessResult,
  pickAiMove,
} from '../../src/lib/chess.ts';
import type { ChessState } from '../../src/lib/chess.ts';
import { validCheckpoint } from '../../src/lib/checkpoints.ts';
const json = (s: unknown) => JSON.parse(JSON.stringify(s));
test('Chess legal moves and position transitions match the baseline through a complete game', () => {
  const source = readFileSync('../games/chess.js', 'utf8');
  const code = source
    .slice(source.indexOf('const FILES'), source.indexOf('export default {'))
    .replaceAll('export function', 'function');
  const old = runInNewContext(
    `${code}; ({initialState,generateLegalMoves,applyMove,validCheckpoint,insufficientMaterial})`,
  );
  let next = newChess('pvp', 'w'),
    baseline = old.initialState();
  const sequence = [
    [13, 21],
    [52, 36],
    [14, 30],
    [59, 31],
  ];
  for (const [from, to] of sequence) {
    assert.deepEqual(
      json(generateLegalMoves(next.state, next.state.turn)),
      json(old.generateLegalMoves(baseline, baseline.turn)),
    );
    const m = old
      .generateLegalMoves(baseline, baseline.turn)
      .find(
        (m: { from: number; to: number }) => m.from === from && m.to === to,
      );
    old.applyMove(baseline, from, m);
    next = moveChess(next, from, to)!;
    assert.deepEqual(next.state, json(baseline));
    assert.equal(validChess(next, true), old.validCheckpoint(json(next), true));
  }
  assert.deepEqual(chessResult(next), { over: true, winner: 'b', check: true });
  assert.equal(validCheckpoint('chess', next), false);
  assert.equal(moveChess(next, 0, 8), null);
  assert.equal(generateLegalMoves(initialState(), 'w').length, 20);
});
function sparse(): ChessState {
  const s = newChess('pvp', 'w');
  s.state.board.fill(null);
  s.state.board[4] = { type: 'k', color: 'w' };
  s.state.board[60] = { type: 'k', color: 'b' };
  s.state.castling = { wK: false, wQ: false, bK: false, bQ: false };
  return s;
}
test('Chess supports castling, en passant, all promotions and draw rules', () => {
  let s = sparse();
  s.state.board[7] = { type: 'r', color: 'w' };
  s.state.castling.wK = true;
  s = moveChess(s, 4, 6)!;
  assert.equal(s.state.board[5]?.type, 'r');
  assert.equal(s.state.board[7], null);
  assert.equal(s.state.castling.wK, false);
  s = sparse();
  s.state.board[36] = { type: 'p', color: 'w' };
  s.state.board[51] = { type: 'p', color: 'b' };
  s.state.turn = 'b';
  s = moveChess(s, 51, 35)!;
  assert.equal(s.state.epTarget, 43);
  s = moveChess(s, 36, 43)!;
  assert.equal(s.state.board[35], null);
  assert.deepEqual(s.captured.b, ['p']);
  for (const type of ['q', 'r', 'b', 'n'] as const) {
    s = sparse();
    s.state.board[48] = { type: 'p', color: 'w' };
    s = moveChess(s, 48, 56)!;
    assert.deepEqual(s.pendingPromotion, { from: 48, to: 56 });
    assert.ok(validChess(s));
    assert.equal(moveChess(s, 4, 5), null);
    assert.equal(moveChess(s, 48, 56), null);
    s = moveChess(s, 48, 56, type)!;
    assert.equal(s.state.board[56]?.type, type);
    assert.equal(s.pendingPromotion, null);
  }
  s = sparse();
  assert.equal(chessResult(s).over, true);
  assert.equal(chessResult(s).winner, null);
  s.state.board[4] = null;
  s.state.board[60] = null;
  s.state.board[56] = { type: 'k', color: 'b' };
  s.state.board[42] = { type: 'k', color: 'w' };
  s.state.board[41] = { type: 'q', color: 'w' };
  s.state.turn = 'b';
  assert.deepEqual(chessResult(s), { over: true, winner: null, check: false });
  const start = newChess('ai', 'b');
  assert.ok(pickAiMove(start.state, 'w'));
  assert.equal(moveChess(start, 12, 36), null);
  assert.equal(
    validChess({ ...start, state: { ...start.state, board: [] } }),
    false,
  );
});
