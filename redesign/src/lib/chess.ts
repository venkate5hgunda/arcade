// Native typed rules port of games/chess.js. Board indices run from a1 to h8.
export type Color = 'w' | 'b';
export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
export interface Piece {
  type: PieceType;
  color: Color;
}
export interface ChessPosition {
  board: (Piece | null)[];
  turn: Color;
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
  epTarget: number | null;
}
export interface ChessMove {
  from?: number;
  to: number;
  promotion?: boolean;
  promotionPiece?: PieceType;
  capture?: boolean;
  doubleStep?: boolean;
  isEnPassant?: boolean;
  isCastle?: 'K' | 'Q';
}
export type LegalMove = ChessMove & { from: number };
export interface ChessState {
  mode: 'ai' | 'pvp';
  side: Color;
  state: ChessPosition;
  captured: Record<Color, PieceType[]>;
  over: boolean;
  lastMove: { from: number; to: number } | null;
  pendingPromotion: { from: number; to: number } | null;
}
const FILES = 'abcdefgh';
const KNIGHT_OFFSETS = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];
const KING_OFFSETS = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];
const BISHOP_DIRS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const ROOK_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
export const PIECE_NAMES = {
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
};
const PIECE_ART: Record<PieceType, string> = {
  p: `
    <circle class="chess-body" cx="32" cy="17" r="8"/>
    <path class="chess-glint" d="M28 13q3-3 7-1"/>
    <path class="chess-body" d="M27 27h10l2 5-2 3 6 15H21l6-15-2-3z"/>
    <path class="chess-band" d="M25 32h14"/>
    <path class="chess-glint" d="M28 37l-4 10"/>
    <path class="chess-body" d="M18 50h28l3 6H15z"/>`,
  r: `
    <path class="chess-body" d="M15 10h8v6h6v-6h6v6h6v-6h8v18H15z"/>
    <path class="chess-band" d="M17 23h30v5H17z"/>
    <path class="chess-body" d="M22 28h20l4 22H18z"/>
    <path class="chess-glint" d="M25 32l-3 14"/>
    <path class="chess-body" d="M15 50h34l3 6H12z"/>`,
  n: `
    <path class="chess-body" d="M17 50c1-9 6-14 6-18l-6-1q-5-1-3-5l8-9 2-8 5 5 5-5q12 6 11 19l-4 5q0 10 8 17z"/>
    <path class="chess-detail" d="M17 28l5 2m17-14q2 8-5 16l4 5"/>
    <circle class="chess-detail-dot" cx="27" cy="21" r="2"/>
    <path class="chess-glint" d="M25 12l2 5"/>
    <path class="chess-band" d="M18 46h29l2 4H16z"/>
    <path class="chess-body" d="M14 50h35l3 6H12z"/>`,
  b: `
    <circle class="chess-band" cx="32" cy="10" r="3"/>
    <path class="chess-body" d="M32 12c9 4 13 9 13 16 0 5-5 9-9 12h-8c-4-3-9-7-9-12 0-7 4-12 13-16z"/>
    <path class="chess-detail" d="M38 19L26 34"/>
    <path class="chess-glint" d="M26 20q-4 4-3 9"/>
    <path class="chess-body" d="M25 40h14l5 10H20z"/>
    <path class="chess-band" d="M23 40h18"/>
    <path class="chess-body" d="M16 50h32l3 6H13z"/>`,
  q: `
    <path class="chess-body" d="M12 18l8 9 6-14 6 12 6-12 6 14 8-9-7 27H19z"/>
    <circle class="chess-band" cx="12" cy="17" r="3"/>
    <circle class="chess-band" cx="26" cy="12" r="3"/>
    <circle class="chess-band" cx="38" cy="12" r="3"/>
    <circle class="chess-band" cx="52" cy="17" r="3"/>
    <path class="chess-detail" d="M22 42h20"/>
    <path class="chess-body" d="M19 45h26l2 5H17zM15 50h34l3 6H12z"/>`,
  k: `
    <path class="chess-body" d="M29 7h6v8h8v6h-8v8h-6v-8h-8v-6h8z"/>
    <path class="chess-body" d="M25 31q7-5 14 0l5 14H20z"/>
    <path class="chess-glint" d="M26 35l-3 7"/>
    <path class="chess-band" d="M19 45h26l2 5H17z"/>
    <path class="chess-body" d="M15 50h34l3 6H12z"/>`,
};

export function chessPieceMarkup(type: PieceType, color: Color) {
  if (!Object.hasOwn(PIECE_ART, type) || !['w', 'b'].includes(color))
    throw new TypeError('Unknown chess piece.');
  return `<svg class="chess-piece ${color === 'w' ? 'cw' : 'cb'}" viewBox="8 4 48 54" aria-hidden="true" focusable="false">${PIECE_ART[type]}</svg>`;
}
const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const PROMO_CHOICES: PieceType[] = ['q', 'r', 'b', 'n'];

export function opp(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}
function rankOf(sq: number) {
  return Math.floor(sq / 8);
}
function fileOf(sq: number) {
  return sq % 8;
}
function sqAt(rank: number, file: number) {
  return rank < 0 || rank > 7 || file < 0 || file > 7 ? -1 : rank * 8 + file;
}
export function sqName(sq: number) {
  return FILES[fileOf(sq)] + (rankOf(sq) + 1);
}

function initialBoard(): (Piece | null)[] {
  const b = new Array(64).fill(null);
  const back: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let f = 0; f < 8; f++) {
    b[sqAt(0, f)] = { type: back[f], color: 'w' };
    b[sqAt(1, f)] = { type: 'p', color: 'w' };
    b[sqAt(6, f)] = { type: 'p', color: 'b' };
    b[sqAt(7, f)] = { type: back[f], color: 'b' };
  }
  return b;
}

export function initialState(): ChessPosition {
  return {
    board: initialBoard(),
    turn: 'w',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    epTarget: null,
  };
}

export function validChess(
  value: unknown,
  allowFinished = false,
): value is ChessState {
  const snapshot = value as ChessState;
  if (
    !snapshot ||
    typeof snapshot !== 'object' ||
    !Object.keys(snapshot).every((k) =>
      [
        'mode',
        'side',
        'state',
        'captured',
        'over',
        'lastMove',
        'pendingPromotion',
      ].includes(k),
    ) ||
    !snapshot.state ||
    !Object.keys(snapshot.state).every((k) =>
      ['board', 'turn', 'castling', 'epTarget'].includes(k),
    )
  )
    return false;
  if (
    !snapshot ||
    typeof snapshot !== 'object' ||
    !['pvp', 'ai'].includes(snapshot.mode) ||
    !['w', 'b'].includes(snapshot.side) ||
    !snapshot.state ||
    typeof snapshot.state !== 'object'
  )
    return false;
  const { board, turn, castling, epTarget } = snapshot.state;
  if (
    !Array.isArray(board) ||
    board.length !== 64 ||
    board.some(
      (piece) =>
        piece !== null &&
        (!piece ||
          !['k', 'q', 'r', 'b', 'n', 'p'].includes(piece.type) ||
          !['w', 'b'].includes(piece.color)),
    ) ||
    board.filter((p) => p?.type === 'k' && p.color === 'w').length !== 1 ||
    board.filter((p) => p?.type === 'k' && p.color === 'b').length !== 1 ||
    !['w', 'b'].includes(turn) ||
    !castling ||
    typeof castling !== 'object' ||
    !(['wK', 'wQ', 'bK', 'bQ'] as const).every(
      (key) => typeof castling[key] === 'boolean',
    ) ||
    !(
      epTarget === null ||
      (Number.isInteger(epTarget) && epTarget >= 0 && epTarget < 64)
    )
  )
    return false;
  if (
    !snapshot.captured ||
    !(['w', 'b'] as const).every(
      (color) =>
        Array.isArray(snapshot.captured[color]) &&
        snapshot.captured[color].length <= 16 &&
        snapshot.captured[color].every((type) =>
          ['q', 'r', 'b', 'n', 'p'].includes(type),
        ),
    )
  )
    return false;
  if (
    typeof snapshot.over !== 'boolean' ||
    !(
      snapshot.lastMove === null ||
      (snapshot.lastMove &&
        [snapshot.lastMove.from, snapshot.lastMove.to].every(
          (sq) => Number.isInteger(sq) && sq >= 0 && sq < 64,
        ))
    )
  )
    return false;
  if (
    snapshot.pendingPromotion !== null &&
    snapshot.pendingPromotion !== undefined
  ) {
    const pending = snapshot.pendingPromotion;
    if (
      snapshot.over ||
      !pending ||
      !Number.isInteger(pending.from) ||
      !Number.isInteger(pending.to) ||
      pending.from < 0 ||
      pending.from > 63 ||
      pending.to < 0 ||
      pending.to > 63 ||
      !board[pending.from] ||
      board[pending.from]!.type !== 'p' ||
      board[pending.from]!.color !== turn ||
      (snapshot.mode === 'ai' && turn !== snapshot.side) ||
      !generateLegalMoves(snapshot.state, turn).some(
        (m) => m.from === pending.from && m.to === pending.to && m.promotion,
      )
    )
      return false;
  }
  return (
    (!snapshot.over || allowFinished) &&
    !isSquareAttacked(board, findKing(board, opp(turn)), turn)
  );
}

function slidingTargets(
  board: (Piece | null)[],
  sq: number,
  color: Color,
  dirs: number[][],
) {
  const targets = [];
  const r0 = rankOf(sq),
    f0 = fileOf(sq);
  for (const [dr, df] of dirs) {
    let r = r0 + dr,
      f = f0 + df;
    while (true) {
      const t = sqAt(r, f);
      if (t === -1) break;
      const occ = board[t];
      if (!occ) {
        targets.push(t);
      } else {
        if (occ.color !== color) targets.push(t);
        break;
      }
      r += dr;
      f += df;
    }
  }
  return targets;
}

export function isSquareAttacked(
  board: (Piece | null)[],
  sq: number,
  byColor: Color,
) {
  const r0 = rankOf(sq),
    f0 = fileOf(sq);
  const pawnDir = byColor === 'w' ? -1 : 1;
  for (const df of [-1, 1]) {
    const t = sqAt(r0 + pawnDir, f0 + df);
    if (t !== -1) {
      const o = board[t];
      if (o && o.color === byColor && o.type === 'p') return true;
    }
  }
  for (const [dr, df] of KNIGHT_OFFSETS) {
    const t = sqAt(r0 + dr, f0 + df);
    if (t !== -1) {
      const o = board[t];
      if (o && o.color === byColor && o.type === 'n') return true;
    }
  }
  for (const [dr, df] of KING_OFFSETS) {
    const t = sqAt(r0 + dr, f0 + df);
    if (t !== -1) {
      const o = board[t];
      if (o && o.color === byColor && o.type === 'k') return true;
    }
  }
  for (const [dr, df] of BISHOP_DIRS) {
    let r = r0 + dr,
      f = f0 + df;
    while (true) {
      const t = sqAt(r, f);
      if (t === -1) break;
      const o = board[t];
      if (o) {
        if (o.color === byColor && (o.type === 'b' || o.type === 'q'))
          return true;
        break;
      }
      r += dr;
      f += df;
    }
  }
  for (const [dr, df] of ROOK_DIRS) {
    let r = r0 + dr,
      f = f0 + df;
    while (true) {
      const t = sqAt(r, f);
      if (t === -1) break;
      const o = board[t];
      if (o) {
        if (o.color === byColor && (o.type === 'r' || o.type === 'q'))
          return true;
        break;
      }
      r += dr;
      f += df;
    }
  }
  return false;
}

export function findKing(board: (Piece | null)[], color: Color) {
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.type === 'k' && p.color === color) return i;
  }
  return -1;
}

function pseudoMovesForSquare(state: ChessPosition, sq: number): ChessMove[] {
  const { board } = state;
  const piece = board[sq];
  if (!piece) return [];
  const { type, color } = piece;
  const r0 = rankOf(sq),
    f0 = fileOf(sq);
  const moves: ChessMove[] = [];
  if (type === 'p') {
    const dir = color === 'w' ? 1 : -1;
    const startRank = color === 'w' ? 1 : 6;
    const promoRank = color === 'w' ? 7 : 0;
    const one = sqAt(r0 + dir, f0);
    if (one !== -1 && !board[one]) {
      moves.push({ to: one, promotion: rankOf(one) === promoRank });
      if (r0 === startRank) {
        const two = sqAt(r0 + 2 * dir, f0);
        if (two !== -1 && !board[two])
          moves.push({ to: two, doubleStep: true });
      }
    }
    for (const df of [-1, 1]) {
      const t = sqAt(r0 + dir, f0 + df);
      if (t === -1) continue;
      const occ = board[t];
      if (occ && occ.color !== color)
        moves.push({
          to: t,
          capture: true,
          promotion: rankOf(t) === promoRank,
        });
      else if (!occ && state.epTarget === t)
        moves.push({ to: t, capture: true, isEnPassant: true });
    }
  } else if (type === 'n') {
    for (const [dr, df] of KNIGHT_OFFSETS) {
      const t = sqAt(r0 + dr, f0 + df);
      if (t === -1) continue;
      const occ = board[t];
      if (!occ || occ.color !== color) moves.push({ to: t, capture: !!occ });
    }
  } else if (type === 'b') {
    for (const t of slidingTargets(board, sq, color, BISHOP_DIRS))
      moves.push({ to: t, capture: !!board[t] });
  } else if (type === 'r') {
    for (const t of slidingTargets(board, sq, color, ROOK_DIRS))
      moves.push({ to: t, capture: !!board[t] });
  } else if (type === 'q') {
    for (const t of slidingTargets(board, sq, color, [
      ...BISHOP_DIRS,
      ...ROOK_DIRS,
    ]))
      moves.push({ to: t, capture: !!board[t] });
  } else if (type === 'k') {
    for (const [dr, df] of KING_OFFSETS) {
      const t = sqAt(r0 + dr, f0 + df);
      if (t === -1) continue;
      const occ = board[t];
      if (!occ || occ.color !== color) moves.push({ to: t, capture: !!occ });
    }
    const rank = color === 'w' ? 0 : 7;
    if (sq === sqAt(rank, 4)) {
      const canK = color === 'w' ? state.castling.wK : state.castling.bK;
      const canQ = color === 'w' ? state.castling.wQ : state.castling.bQ;
      const notInCheck = !isSquareAttacked(board, sqAt(rank, 4), opp(color));
      if (
        canK &&
        notInCheck &&
        !board[sqAt(rank, 5)] &&
        !board[sqAt(rank, 6)] &&
        board[sqAt(rank, 7)]?.type === 'r' &&
        board[sqAt(rank, 7)]?.color === color &&
        !isSquareAttacked(board, sqAt(rank, 5), opp(color)) &&
        !isSquareAttacked(board, sqAt(rank, 6), opp(color))
      ) {
        moves.push({ to: sqAt(rank, 6), isCastle: 'K' });
      }
      if (
        canQ &&
        notInCheck &&
        !board[sqAt(rank, 3)] &&
        !board[sqAt(rank, 2)] &&
        !board[sqAt(rank, 1)] &&
        board[sqAt(rank, 0)]?.type === 'r' &&
        board[sqAt(rank, 0)]?.color === color &&
        !isSquareAttacked(board, sqAt(rank, 3), opp(color)) &&
        !isSquareAttacked(board, sqAt(rank, 2), opp(color))
      ) {
        moves.push({ to: sqAt(rank, 2), isCastle: 'Q' });
      }
    }
  }
  return moves;
}

// Non-mutating: returns { board, captured } for a candidate move.
function simulateMove(state: ChessPosition, from: number, m: ChessMove) {
  const board = state.board.slice();
  const piece = board[from]!;
  let captured = board[m.to];
  board[from] = null;
  if (m.isEnPassant) {
    const capSq = sqAt(rankOf(from), fileOf(m.to));
    captured = board[capSq];
    board[capSq] = null;
  }
  board[m.to] = m.promotion
    ? { type: m.promotionPiece || 'q', color: piece.color }
    : piece;
  if (m.isCastle) {
    const rank = rankOf(from);
    if (m.isCastle === 'K') {
      board[sqAt(rank, 5)] = board[sqAt(rank, 7)];
      board[sqAt(rank, 7)] = null;
    } else {
      board[sqAt(rank, 3)] = board[sqAt(rank, 0)];
      board[sqAt(rank, 0)] = null;
    }
  }
  return { board, captured };
}

export function generateLegalMoves(
  state: ChessPosition,
  color: Color,
): LegalMove[] {
  const results: LegalMove[] = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = state.board[sq];
    if (!p || p.color !== color) continue;
    for (const m of pseudoMovesForSquare(state, sq)) {
      const { board } = simulateMove(state, sq, m);
      const kingSq = findKing(board, color);
      if (kingSq !== -1 && !isSquareAttacked(board, kingSq, opp(color)))
        results.push({ from: sq, ...m });
    }
  }
  return results;
}

// Mutates `state` in place; returns the captured piece (or null).
function applyMove(state: ChessPosition, from: number, m: ChessMove) {
  const piece = state.board[from]!;
  const { board, captured } = simulateMove(state, from, m);
  state.board = board;
  if (piece.type === 'k') {
    if (piece.color === 'w') {
      state.castling.wK = false;
      state.castling.wQ = false;
    } else {
      state.castling.bK = false;
      state.castling.bQ = false;
    }
  }
  if (
    piece.type === 'r' ||
    m.to === 0 ||
    m.to === 7 ||
    m.to === 56 ||
    m.to === 63
  ) {
    if (from === 0 || m.to === 0) state.castling.wQ = false;
    if (from === 7 || m.to === 7) state.castling.wK = false;
    if (from === 56 || m.to === 56) state.castling.bQ = false;
    if (from === 63 || m.to === 63) state.castling.bK = false;
  }
  state.epTarget = m.doubleStep ? (from + m.to) / 2 : null;
  state.turn = opp(state.turn);
  return captured;
}

function cloneState(state: ChessPosition): ChessPosition {
  return {
    board: state.board.slice(),
    turn: state.turn,
    castling: { ...state.castling },
    epTarget: state.epTarget,
  };
}

function stateAfterMove(state: ChessPosition, from: number, m: ChessMove) {
  const clone = cloneState(state);
  applyMove(clone, from, m);
  return clone;
}

export function insufficientMaterial(board: (Piece | null)[]) {
  const pieces = board.filter((p): p is Piece => p !== null);
  if (pieces.some((p) => p.type === 'p' || p.type === 'q' || p.type === 'r'))
    return false;
  const minorCount = pieces.filter(
    (p) => p.type === 'n' || p.type === 'b',
  ).length;
  return minorCount <= 1; // K vs K, or K+minor vs K
}

export function pickAiMove(state: ChessPosition, aiColor: Color) {
  const moves = generateLegalMoves(state, aiColor);
  if (moves.length === 0) return null;
  const humanColor = opp(aiColor);
  let best = null,
    bestScore = -Infinity;
  for (const m of moves) {
    const move = m.promotion ? { ...m, promotionPiece: 'q' as const } : m;
    const capturedPiece =
      state.board[m.to] || (m.isEnPassant ? { type: 'p' as const } : null);
    let score = capturedPiece ? PIECE_VALUE[capturedPiece.type] * 10 : 0;
    const after = stateAfterMove(state, m.from, move);
    const kingSq = findKing(after.board, humanColor);
    const givesCheck =
      kingSq !== -1 && isSquareAttacked(after.board, kingSq, aiColor);
    if (givesCheck) {
      score += 3;
      if (generateLegalMoves(after, humanColor).length === 0) score += 1000; // checkmate
    }
    score +=
      3.5 - Math.abs(3.5 - rankOf(m.to)) + (3.5 - Math.abs(3.5 - fileOf(m.to)));
    score += Math.random() * 0.75;
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

export function newChess(mode: 'ai' | 'pvp', side: Color): ChessState {
  return {
    mode,
    side,
    state: initialState(),
    captured: { w: [], b: [] },
    over: false,
    lastMove: null,
    pendingPromotion: null,
  };
}
export function chessResult(s: ChessState): {
  over: boolean;
  winner: Color | null;
  check: boolean;
} {
  const check = isSquareAttacked(
    s.state.board,
    findKing(s.state.board, s.state.turn),
    opp(s.state.turn),
  );
  const legal = generateLegalMoves(s.state, s.state.turn);
  return {
    over: legal.length === 0 || insufficientMaterial(s.state.board),
    winner: legal.length === 0 && check ? opp(s.state.turn) : null,
    check,
  };
}
export function moveChess(
  s: ChessState,
  from: number,
  to: number,
  promotion?: PieceType,
): ChessState | null {
  if (
    s.over ||
    (s.pendingPromotion &&
      (s.pendingPromotion.from !== from ||
        s.pendingPromotion.to !== to ||
        !promotion))
  )
    return null;
  const m = generateLegalMoves(s.state, s.state.turn).find(
    (m) => m.from === from && m.to === to,
  );
  if (!m || (promotion && (!m.promotion || !PROMO_CHOICES.includes(promotion))))
    return null;
  if (m.promotion && !promotion)
    return { ...s, pendingPromotion: { from, to } };
  const position = cloneState(s.state),
    captured = { w: [...s.captured.w], b: [...s.captured.b] };
  const piece = applyMove(position, from, { ...m, promotionPiece: promotion });
  if (piece) captured[piece.color].push(piece.type);
  const next = {
    ...s,
    state: position,
    captured,
    lastMove: { from, to },
    pendingPromotion: null,
  };
  return { ...next, over: chessResult(next).over };
}
