// Chess — full rules engine (legal moves, check/checkmate/stalemate,
// castling, en passant, promotion) with local pass-and-play or a
// lightweight heuristic AI opponent.
// Pure DOM; listens to arcade:themechange to repaint accents.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { playerName } from '../js/player-names.js';
import { celebrate } from '../js/celebration.js';
import { createTurnIndicator } from '../js/turn-indicator.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';
import { remoteMatch, seat, validTurn } from '../js/remote-match.js';

const FILES = 'abcdefgh';
const KNIGHT_OFFSETS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING_OFFSETS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const PIECE_NAMES = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const PIECE_ART = {
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

export function chessPieceMarkup(type, color) {
  if (!Object.hasOwn(PIECE_ART, type) || !['w', 'b'].includes(color))
    throw new TypeError('Unknown chess piece.');
  return `<svg class="chess-piece ${color === 'w' ? 'cw' : 'cb'}" viewBox="8 4 48 54" aria-hidden="true" focusable="false">${PIECE_ART[type]}</svg>`;
}
const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const PROMO_CHOICES = ['q', 'r', 'b', 'n'];

function opp(color) { return color === 'w' ? 'b' : 'w'; }
function rankOf(sq) { return Math.floor(sq / 8); }
function fileOf(sq) { return sq % 8; }
function sqAt(rank, file) { return (rank < 0 || rank > 7 || file < 0 || file > 7) ? -1 : rank * 8 + file; }
function sqName(sq) { return FILES[fileOf(sq)] + (rankOf(sq) + 1); }

function initialBoard() {
  const b = new Array(64).fill(null);
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let f = 0; f < 8; f++) {
    b[sqAt(0, f)] = { type: back[f], color: 'w' };
    b[sqAt(1, f)] = { type: 'p', color: 'w' };
    b[sqAt(6, f)] = { type: 'p', color: 'b' };
    b[sqAt(7, f)] = { type: back[f], color: 'b' };
  }
  return b;
}

function initialState() {
  return {
    board: initialBoard(),
    turn: 'w',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    epTarget: null,
  };
}

function validCheckpoint(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || !['pvp', 'ai'].includes(snapshot.mode) ||
      !['w', 'b'].includes(snapshot.side) || !snapshot.state || typeof snapshot.state !== 'object') return false;
  const { board, turn, castling, epTarget } = snapshot.state;
  if (!Array.isArray(board) || board.length !== 64 ||
      board.some((piece) => piece !== null && (!piece || !['k', 'q', 'r', 'b', 'n', 'p'].includes(piece.type) ||
        !['w', 'b'].includes(piece.color))) ||
      board.filter((p) => p?.type === 'k' && p.color === 'w').length !== 1 ||
      board.filter((p) => p?.type === 'k' && p.color === 'b').length !== 1 ||
      !['w', 'b'].includes(turn) || !castling || typeof castling !== 'object' ||
      !['wK', 'wQ', 'bK', 'bQ'].every((key) => typeof castling[key] === 'boolean') ||
      !(epTarget === null || (Number.isInteger(epTarget) && epTarget >= 0 && epTarget < 64))) return false;
  if (!snapshot.captured || !['w', 'b'].every((color) =>
    Array.isArray(snapshot.captured[color]) && snapshot.captured[color].length <= 16 &&
    snapshot.captured[color].every((type) => ['q', 'r', 'b', 'n', 'p'].includes(type)))) return false;
  if (typeof snapshot.over !== 'boolean' ||
      !(snapshot.lastMove === null || (snapshot.lastMove && [snapshot.lastMove.from, snapshot.lastMove.to]
        .every((sq) => Number.isInteger(sq) && sq >= 0 && sq < 64)))) return false;
  if (snapshot.pendingPromotion !== null && snapshot.pendingPromotion !== undefined) {
    const pending = snapshot.pendingPromotion;
    if (snapshot.over || !pending || !Number.isInteger(pending.from) || !Number.isInteger(pending.to) ||
        pending.from < 0 || pending.from > 63 || pending.to < 0 || pending.to > 63 ||
        !board[pending.from] || board[pending.from].type !== 'p' ||
        board[pending.from].color !== turn || snapshot.mode === 'ai' && turn !== snapshot.side ||
        !generateLegalMoves(snapshot.state, turn).some((m) =>
          m.from === pending.from && m.to === pending.to && m.promotion)) return false;
  }
  return !snapshot.over && !isSquareAttacked(board, findKing(board, opp(turn)), turn);
}

function slidingTargets(board, sq, color, dirs) {
  const targets = [];
  const r0 = rankOf(sq), f0 = fileOf(sq);
  for (const [dr, df] of dirs) {
    let r = r0 + dr, f = f0 + df;
    while (true) {
      const t = sqAt(r, f);
      if (t === -1) break;
      const occ = board[t];
      if (!occ) { targets.push(t); } else { if (occ.color !== color) targets.push(t); break; }
      r += dr; f += df;
    }
  }
  return targets;
}

function isSquareAttacked(board, sq, byColor) {
  const r0 = rankOf(sq), f0 = fileOf(sq);
  const pawnDir = byColor === 'w' ? -1 : 1;
  for (const df of [-1, 1]) {
    const t = sqAt(r0 + pawnDir, f0 + df);
    if (t !== -1) { const o = board[t]; if (o && o.color === byColor && o.type === 'p') return true; }
  }
  for (const [dr, df] of KNIGHT_OFFSETS) {
    const t = sqAt(r0 + dr, f0 + df);
    if (t !== -1) { const o = board[t]; if (o && o.color === byColor && o.type === 'n') return true; }
  }
  for (const [dr, df] of KING_OFFSETS) {
    const t = sqAt(r0 + dr, f0 + df);
    if (t !== -1) { const o = board[t]; if (o && o.color === byColor && o.type === 'k') return true; }
  }
  for (const [dr, df] of BISHOP_DIRS) {
    let r = r0 + dr, f = f0 + df;
    while (true) {
      const t = sqAt(r, f); if (t === -1) break;
      const o = board[t];
      if (o) { if (o.color === byColor && (o.type === 'b' || o.type === 'q')) return true; break; }
      r += dr; f += df;
    }
  }
  for (const [dr, df] of ROOK_DIRS) {
    let r = r0 + dr, f = f0 + df;
    while (true) {
      const t = sqAt(r, f); if (t === -1) break;
      const o = board[t];
      if (o) { if (o.color === byColor && (o.type === 'r' || o.type === 'q')) return true; break; }
      r += dr; f += df;
    }
  }
  return false;
}

function findKing(board, color) {
  for (let i = 0; i < 64; i++) { const p = board[i]; if (p && p.type === 'k' && p.color === color) return i; }
  return -1;
}

function pseudoMovesForSquare(state, sq) {
  const { board } = state;
  const piece = board[sq];
  if (!piece) return [];
  const { type, color } = piece;
  const r0 = rankOf(sq), f0 = fileOf(sq);
  const moves = [];
  if (type === 'p') {
    const dir = color === 'w' ? 1 : -1;
    const startRank = color === 'w' ? 1 : 6;
    const promoRank = color === 'w' ? 7 : 0;
    const one = sqAt(r0 + dir, f0);
    if (one !== -1 && !board[one]) {
      moves.push({ to: one, promotion: rankOf(one) === promoRank });
      if (r0 === startRank) {
        const two = sqAt(r0 + 2 * dir, f0);
        if (two !== -1 && !board[two]) moves.push({ to: two, doubleStep: true });
      }
    }
    for (const df of [-1, 1]) {
      const t = sqAt(r0 + dir, f0 + df);
      if (t === -1) continue;
      const occ = board[t];
      if (occ && occ.color !== color) moves.push({ to: t, capture: true, promotion: rankOf(t) === promoRank });
      else if (!occ && state.epTarget === t) moves.push({ to: t, capture: true, isEnPassant: true });
    }
  } else if (type === 'n') {
    for (const [dr, df] of KNIGHT_OFFSETS) {
      const t = sqAt(r0 + dr, f0 + df);
      if (t === -1) continue;
      const occ = board[t];
      if (!occ || occ.color !== color) moves.push({ to: t, capture: !!occ });
    }
  } else if (type === 'b') {
    for (const t of slidingTargets(board, sq, color, BISHOP_DIRS)) moves.push({ to: t, capture: !!board[t] });
  } else if (type === 'r') {
    for (const t of slidingTargets(board, sq, color, ROOK_DIRS)) moves.push({ to: t, capture: !!board[t] });
  } else if (type === 'q') {
    for (const t of slidingTargets(board, sq, color, [...BISHOP_DIRS, ...ROOK_DIRS])) moves.push({ to: t, capture: !!board[t] });
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
      if (canK && notInCheck && !board[sqAt(rank, 5)] && !board[sqAt(rank, 6)] &&
          board[sqAt(rank, 7)]?.type === 'r' && board[sqAt(rank, 7)]?.color === color &&
          !isSquareAttacked(board, sqAt(rank, 5), opp(color)) && !isSquareAttacked(board, sqAt(rank, 6), opp(color))) {
        moves.push({ to: sqAt(rank, 6), isCastle: 'K' });
      }
      if (canQ && notInCheck && !board[sqAt(rank, 3)] && !board[sqAt(rank, 2)] && !board[sqAt(rank, 1)] &&
          board[sqAt(rank, 0)]?.type === 'r' && board[sqAt(rank, 0)]?.color === color &&
          !isSquareAttacked(board, sqAt(rank, 3), opp(color)) && !isSquareAttacked(board, sqAt(rank, 2), opp(color))) {
        moves.push({ to: sqAt(rank, 2), isCastle: 'Q' });
      }
    }
  }
  return moves;
}

// Non-mutating: returns { board, captured } for a candidate move.
function simulateMove(state, from, m) {
  const board = state.board.slice();
  const piece = board[from];
  let captured = board[m.to];
  board[from] = null;
  if (m.isEnPassant) {
    const capSq = sqAt(rankOf(from), fileOf(m.to));
    captured = board[capSq];
    board[capSq] = null;
  }
  board[m.to] = m.promotion ? { type: m.promotionPiece || 'q', color: piece.color } : piece;
  if (m.isCastle) {
    const rank = rankOf(from);
    if (m.isCastle === 'K') { board[sqAt(rank, 5)] = board[sqAt(rank, 7)]; board[sqAt(rank, 7)] = null; }
    else { board[sqAt(rank, 3)] = board[sqAt(rank, 0)]; board[sqAt(rank, 0)] = null; }
  }
  return { board, captured };
}

function generateLegalMoves(state, color) {
  const results = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = state.board[sq];
    if (!p || p.color !== color) continue;
    for (const m of pseudoMovesForSquare(state, sq)) {
      const { board } = simulateMove(state, sq, m);
      const kingSq = findKing(board, color);
      if (kingSq !== -1 && !isSquareAttacked(board, kingSq, opp(color))) results.push({ from: sq, ...m });
    }
  }
  return results;
}

// Mutates `state` in place; returns the captured piece (or null).
function applyMove(state, from, m) {
  const piece = state.board[from];
  const { board, captured } = simulateMove(state, from, m);
  state.board = board;
  if (piece.type === 'k') { if (piece.color === 'w') { state.castling.wK = false; state.castling.wQ = false; } else { state.castling.bK = false; state.castling.bQ = false; } }
  if (piece.type === 'r' || m.to === 0 || m.to === 7 || m.to === 56 || m.to === 63) {
    if (from === 0 || m.to === 0) state.castling.wQ = false;
    if (from === 7 || m.to === 7) state.castling.wK = false;
    if (from === 56 || m.to === 56) state.castling.bQ = false;
    if (from === 63 || m.to === 63) state.castling.bK = false;
  }
  state.epTarget = m.doubleStep ? (from + m.to) / 2 : null;
  state.turn = opp(state.turn);
  return captured;
}

function cloneState(state) {
  return { board: state.board.slice(), turn: state.turn, castling: { ...state.castling }, epTarget: state.epTarget };
}

function stateAfterMove(state, from, m) {
  const clone = cloneState(state);
  applyMove(clone, from, m);
  return clone;
}

function insufficientMaterial(board) {
  const pieces = board.filter(Boolean);
  if (pieces.some((p) => p.type === 'p' || p.type === 'q' || p.type === 'r')) return false;
  const minorCount = pieces.filter((p) => p.type === 'n' || p.type === 'b').length;
  return minorCount <= 1; // K vs K, or K+minor vs K
}

function pickAiMove(state, aiColor) {
  const moves = generateLegalMoves(state, aiColor);
  if (moves.length === 0) return null;
  const humanColor = opp(aiColor);
  let best = null, bestScore = -Infinity;
  for (const m of moves) {
    const move = m.promotion ? { ...m, promotionPiece: 'q' } : m;
    const capturedPiece = state.board[m.to] || (m.isEnPassant ? { type: 'p' } : null);
    let score = capturedPiece ? PIECE_VALUE[capturedPiece.type] * 10 : 0;
    const after = stateAfterMove(state, m.from, move);
    const kingSq = findKing(after.board, humanColor);
    const givesCheck = kingSq !== -1 && isSquareAttacked(after.board, kingSq, aiColor);
    if (givesCheck) {
      score += 3;
      if (generateLegalMoves(after, humanColor).length === 0) score += 1000; // checkmate
    }
    score += (3.5 - Math.abs(3.5 - rankOf(m.to))) + (3.5 - Math.abs(3.5 - fileOf(m.to)));
    score += Math.random() * 0.75;
    if (score > bestScore) { bestScore = score; best = move; }
  }
  return best;
}

export default {
  async render(el, game, { navigate, multiplayer, session } = {}) {
    const shell = createShell(el, game, { title: 'Chess', meta: 'Classic strategy · 64 squares' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('chess-vibe');

    const match = remoteMatch(multiplayer, game.id);
    const showTurn = createTurnIndicator(shell.root, match);
    const resume = !match && validCheckpoint(session?.state) ? session.state : null;
    const saved = loadJSON(KEYS.SETTINGS + ':chess', { mode: 'pvp', side: 'w' });
    const settings = match ? { mode: 'pvp', side: 'w' } : resume ? { mode: resume.mode, side: resume.side } : await renderSetup(stage, {
      title: '♟️ Chess',
      subtitle: 'Choose your opponent',
      themeClass: 'chess-theme',
      fields: [
        {
          key: 'mode', label: 'Opponent',
          options: [{ value: 'pvp', label: '👥 Pass & Play' }, { value: 'ai', label: '🤖 Computer' }],
          default: saved.mode,
        },
        {
          key: 'side', label: 'Play As (vs Computer)',
          options: [{ value: 'w', label: '⚪ White' }, { value: 'b', label: '⚫ Black' }],
          default: saved.side,
        },
      ],
      startLabel: 'Set the Board',
    });
    if (!match) saveJSON(KEYS.SETTINGS + ':chess', settings);
    const aiMode = settings.mode === 'ai';
    const humanSide = settings.side === 'b' ? 'b' : 'w';
    const aiSide = opp(humanSide);
    shell.root.querySelector('.game-meta').textContent = match
      ? `Online room · you are ${seat(match) === 1 ? 'White' : 'Black'}`
      : aiMode
      ? `You (${humanSide === 'w' ? 'White' : 'Black'}) vs Computer`
      : 'Two players · pass the device';

    let state = initialState();
    let selected = null;
    let legalFromSelected = [];
    let lastMove = null;
    let over = false;
    let pendingPromotion = null; // { from, m }
    let aiTimer = null, busy = false, generation = 0;
    const captured = { w: [], b: [] };
    function checkpoint() {
      if (match) return;
      if (over) session?.finish();
      else session?.save({ mode: settings.mode, side: settings.side, state, captured,
        lastMove, over, pendingPromotion: pendingPromotion &&
          { from: pendingPromotion.from, to: pendingPromotion.m.to } });
    }

    const board = document.createElement('div');
    board.className = 'chess-board';
    stage.appendChild(board);

    const status = document.createElement('div');
    status.className = 'chess-status';
    stage.appendChild(status);

    const capturedRow = document.createElement('div');
    capturedRow.className = 'chess-captured';
    stage.appendChild(capturedRow);

    function boardFlipped() {
      return match ? seat(match) === 2 : aiMode ? humanSide === 'b' : state.turn === 'b';
    }

    function render() {
      board.innerHTML = '';
      const flipped = boardFlipped();
      for (let visRow = 0; visRow < 8; visRow++) {
        for (let visCol = 0; visCol < 8; visCol++) {
          const rank = flipped ? visRow : 7 - visRow;
          const file = flipped ? 7 - visCol : visCol;
          const sq = sqAt(rank, file);
          const cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'chess-sq ' + ((rank + file) % 2 === 0 ? 'chess-dark' : 'chess-light');
          const piece = state.board[sq];
          cell.setAttribute('aria-label', piece
            ? `${sqName(sq)}, ${piece.color === 'w' ? 'white' : 'black'} ${PIECE_NAMES[piece.type]}`
            : sqName(sq));
          if (lastMove && (sq === lastMove.from || sq === lastMove.to)) cell.classList.add('chess-lastmove');
          if (selected === sq) cell.classList.add('chess-selected');
          const targetMove = legalFromSelected.find((m) => m.to === sq);
          if (targetMove) cell.classList.add(targetMove.capture ? 'chess-capture-hint' : 'chess-move-hint');
          if (piece) {
            cell.innerHTML = chessPieceMarkup(piece.type, piece.color);
          }
          cell.addEventListener('click', () => onSquareClick(sq));
          board.appendChild(cell);
        }
      }
      renderCaptured();
      renderPromotionPicker();
      updateStatus();
      if (match || !aiMode) showTurn(state.turn === 'w' ? 0 : 1, !over);
    }

    function renderCaptured() {
      const line = (color) => captured[color].map((t) => chessPieceMarkup(t, color)).join('');
      capturedRow.innerHTML = `<div class="chess-captured-row">${line('b')}</div><div class="chess-captured-row">${line('w')}</div>`;
    }

    function renderPromotionPicker() {
      let picker = stage.querySelector('.chess-promo');
      if (picker) picker.remove();
      if (!pendingPromotion) return;
      picker = document.createElement('div');
      picker.className = 'chess-promo';
      const color = state.board[pendingPromotion.from].color;
      picker.innerHTML = `<p>Promote to:</p><div class="chess-promo-options"></div>`;
      const opts = picker.querySelector('.chess-promo-options');
      for (const t of PROMO_CHOICES) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chess-promo-btn';
        btn.setAttribute('aria-label', `Promote to ${PIECE_NAMES[t]}`);
        btn.innerHTML = chessPieceMarkup(t, color);
        btn.addEventListener('click', () => resolvePromotion(t));
        opts.appendChild(btn);
      }
      stage.appendChild(picker);
    }

    function updateStatus() {
      if (over) return;
      const inCheck = isSquareAttacked(state.board, findKing(state.board, state.turn), opp(state.turn));
      const turnLabel = state.turn === 'w' ? 'White' : 'Black';
      if (pendingPromotion) { status.textContent = 'Choose a piece to promote to…'; return; }
      status.textContent = inCheck ? `Check! ${turnLabel} to move` : `${turnLabel} to move`;
      if (match) status.textContent += state.turn === (seat(match) === 1 ? 'w' : 'b')
        ? ' · your turn' : ' · waiting for opponent';
      status.classList.toggle('chess-check', !!inCheck);
      if (aiMode && state.turn === aiSide && !over) status.textContent = 'Computer is thinking…';
    }

    function onSquareClick(sq) {
      if (over || pendingPromotion || busy) return;
      if (aiMode && state.turn === aiSide) return;
      if (match && (state.turn === 'w' ? 1 : 2) !== seat(match)) return;
      const piece = state.board[sq];
      const move = legalFromSelected.find((m) => m.to === sq);
      if (move) { performMove(selected, move); return; }
      if (piece && piece.color === state.turn) {
        selected = sq;
        legalFromSelected = generateLegalMoves(state, state.turn).filter((m) => m.from === sq);
        window.haptics?.select();
      } else {
        selected = null; legalFromSelected = [];
      }
      render();
    }

    function performMove(from, m) {
      if (m.promotion) { pendingPromotion = { from, m }; selected = null; legalFromSelected = []; render(); checkpoint(); return; }
      if (match) match.sendAction({ type: 'move', from, to: m.to });
      else finalizeMove(from, m);
    }

    function resolvePromotion(pieceType) {
      const { from, m } = pendingPromotion;
      pendingPromotion = null;
      if (match) match.sendAction({ type: 'move', from, to: m.to, promotionPiece: pieceType });
      else finalizeMove(from, { ...m, promotionPiece: pieceType });
    }

    async function finalizeMove(from, m) {
      if (busy) return;
      busy = true;
      const started = generation;
      const audio = window.arcadeAudio;
      if (audio) await audio.prepare();
      if (started !== generation) return;
      const capturedPiece = applyMove(state, from, m);
      if (capturedPiece) captured[capturedPiece.color].push(capturedPiece.type);
      lastMove = { from, to: m.to };
      busy = false;
      selected = null; legalFromSelected = [];
      if (audio) capturedPiece ? audio.pop() : audio.tap();
      window.haptics?.select();
      checkGameEnd();
      render();
      checkpoint();
      if (!over && aiMode && state.turn === aiSide) {
        aiTimer = setTimeout(runAiTurn, 500);
      }
    }

    function checkGameEnd() {
      const legal = generateLegalMoves(state, state.turn);
      const inCheck = isSquareAttacked(state.board, findKing(state.board, state.turn), opp(state.turn));
      const audio = window.arcadeAudio;
      if (legal.length === 0) {
        over = true;
        if (inCheck) {
          const side = opp(state.turn);
          const winnerIndex = side === 'w' ? 0 : 1;
          const name = aiMode && side === aiSide ? 'Computer' : playerName(winnerIndex, match);
          status.textContent = `Checkmate! ${name} (${side === 'w' ? 'White' : 'Black'}) wins`;
          if (match?.role === 'host') match.recordResult(game.id, winnerIndex, generation);
          if ((!aiMode || side === humanSide) && (!match || seat(match) === winnerIndex + 1))
            celebrate(shell.root, `${name} wins by checkmate!`);
        } else {
          status.textContent = 'Stalemate — Draw';
          if (match?.role === 'host') match.recordResult(game.id, null, generation);
        }
        if (!inCheck && audio) audio.buzz();
      } else if (insufficientMaterial(state.board)) {
        over = true;
        status.textContent = 'Draw — insufficient material';
        if (match?.role === 'host') match.recordResult(game.id, null, generation);
      }
    }

    function runAiTurn() {
      if (over) return;
      const move = pickAiMove(state, aiSide);
      if (!move) return;
      finalizeMove(move.from, move);
    }

    function newGame() {
      clearTimeout(aiTimer);
      generation++;
      shell.root.querySelector('.arcade-victory')?.remove();
      state = initialState();
      selected = null; legalFromSelected = []; lastMove = null; over = false; pendingPromotion = null; busy = false;
      captured.w = []; captured.b = [];
      render();
      checkpoint();
      if (aiMode && state.turn === aiSide) aiTimer = setTimeout(runAiTurn, 500);
    }

    getResetButton().addEventListener('click', () => {
      if (match) {
        if (match.role === 'host') match.sendAction({ type: 'reset' });
      } else newGame();
    });
    if (match && match.role !== 'host') getResetButton().disabled = true;
    const offRoom = match?.on((event) => {
      if (event.type !== 'action' || match.activeGame?.id !== game.id) return;
      if (event.action?.type === 'reset' && event.from === match.activeGame.playerIds[0]) {
        newGame();
      } else if (event.action?.type === 'move' && !over && validTurn(match, state.turn === 'w' ? 1 : 2, event.from)) {
        const { from, to, promotionPiece } = event.action;
        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > 63 || to < 0 || to > 63) return;
        const move = generateLegalMoves(state, state.turn).find((item) => item.from === from && item.to === to);
        if (!move || (move.promotion && !PROMO_CHOICES.includes(promotionPiece))) return;
        pendingPromotion = null;
        finalizeMove(from, move.promotion ? { ...move, promotionPiece } : move);
      }
    });

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    if (resume) {
      state = resume.state;
      captured.w = resume.captured.w;
      captured.b = resume.captured.b;
      lastMove = resume.lastMove;
      const pending = resume.pendingPromotion;
      if (pending) pendingPromotion = {
        from: pending.from,
        m: generateLegalMoves(state, state.turn).find((m) => m.from === pending.from && m.to === pending.to),
      };
      render();
      if (aiMode && state.turn === aiSide) aiTimer = setTimeout(runAiTurn, 500);
    } else newGame();
    return { dispose: () => {
      clearTimeout(aiTimer);
      generation++;
      offRoom?.();
      window.removeEventListener('arcade:themechange', onTheme);
    } };
  },
};
