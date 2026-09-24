// Chess — full rules engine (legal moves, check/checkmate/stalemate,
// castling, en passant, promotion) with local pass-and-play or a
// lightweight heuristic AI opponent.
// Pure DOM; listens to arcade:themechange to repaint accents.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';

const FILES = 'abcdefgh';
const KNIGHT_OFFSETS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING_OFFSETS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const PIECE_GLYPH = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};
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
  async render(el, game, { navigate } = {}) {
    const shell = createShell(el, game, { title: 'Chess', meta: 'Classic strategy · 64 squares' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('chess-vibe');

    const saved = loadJSON(KEYS.SETTINGS + ':chess', { mode: 'pvp', side: 'w' });
    const settings = await renderSetup(stage, {
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
    saveJSON(KEYS.SETTINGS + ':chess', settings);
    const aiMode = settings.mode === 'ai';
    const humanSide = settings.side === 'b' ? 'b' : 'w';
    const aiSide = opp(humanSide);
    shell.root.querySelector('.game-meta').textContent = aiMode
      ? `You (${humanSide === 'w' ? 'White' : 'Black'}) vs Computer`
      : 'Two players · pass the device';

    let state = initialState();
    let selected = null;
    let legalFromSelected = [];
    let lastMove = null;
    let over = false;
    let pendingPromotion = null; // { from, m }
    const captured = { w: [], b: [] };

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
      return aiMode ? humanSide === 'b' : state.turn === 'b';
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
          cell.setAttribute('aria-label', sqName(sq));
          if (lastMove && (sq === lastMove.from || sq === lastMove.to)) cell.classList.add('chess-lastmove');
          if (selected === sq) cell.classList.add('chess-selected');
          const targetMove = legalFromSelected.find((m) => m.to === sq);
          if (targetMove) cell.classList.add(targetMove.capture ? 'chess-capture-hint' : 'chess-move-hint');
          const piece = state.board[sq];
          if (piece) {
            cell.innerHTML = `<span class="chess-piece ${piece.color === 'w' ? 'cw' : 'cb'}">${PIECE_GLYPH[piece.color][piece.type]}</span>`;
          }
          cell.addEventListener('click', () => onSquareClick(sq));
          board.appendChild(cell);
        }
      }
      renderCaptured();
      renderPromotionPicker();
      updateStatus();
    }

    function renderCaptured() {
      const line = (color) => captured[color].map((t) => `<span class="${color === 'w' ? 'cw' : 'cb'}">${PIECE_GLYPH[color][t]}</span>`).join('');
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
        btn.innerHTML = `<span class="chess-piece ${color === 'w' ? 'cw' : 'cb'}">${PIECE_GLYPH[color][t]}</span>`;
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
      status.classList.toggle('chess-check', !!inCheck);
      if (aiMode && state.turn === aiSide && !over) status.textContent = 'Computer is thinking…';
    }

    function onSquareClick(sq) {
      if (over || pendingPromotion) return;
      if (aiMode && state.turn === aiSide) return;
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
      if (m.promotion) { pendingPromotion = { from, m }; selected = null; legalFromSelected = []; render(); return; }
      finalizeMove(from, m);
    }

    function resolvePromotion(pieceType) {
      const { from, m } = pendingPromotion;
      pendingPromotion = null;
      finalizeMove(from, { ...m, promotionPiece: pieceType });
    }

    async function finalizeMove(from, m) {
      const audio = window.arcadeAudio;
      if (audio) await audio.prepare();
      const capturedPiece = applyMove(state, from, m);
      if (capturedPiece) captured[capturedPiece.color].push(capturedPiece.type);
      lastMove = { from, to: m.to };
      selected = null; legalFromSelected = [];
      if (audio) capturedPiece ? audio.pop() : audio.tap();
      window.haptics?.select();
      checkGameEnd();
      render();
      if (!over && aiMode && state.turn === aiSide) {
        setTimeout(runAiTurn, 500);
      }
    }

    function checkGameEnd() {
      const legal = generateLegalMoves(state, state.turn);
      const inCheck = isSquareAttacked(state.board, findKing(state.board, state.turn), opp(state.turn));
      const audio = window.arcadeAudio;
      if (legal.length === 0) {
        over = true;
        if (inCheck) {
          const winner = opp(state.turn) === 'w' ? 'White' : 'Black';
          status.textContent = `Checkmate! ${winner} wins`;
        } else {
          status.textContent = 'Stalemate — Draw';
        }
        if (audio) inCheck ? audio.chime() : audio.buzz();
        window.haptics?.[inCheck ? 'success' : 'failure']?.();
      } else if (insufficientMaterial(state.board)) {
        over = true;
        status.textContent = 'Draw — insufficient material';
      }
    }

    function runAiTurn() {
      if (over) return;
      const move = pickAiMove(state, aiSide);
      if (!move) return;
      finalizeMove(move.from, move);
    }

    function newGame() {
      state = initialState();
      selected = null; legalFromSelected = []; lastMove = null; over = false; pendingPromotion = null;
      captured.w = []; captured.b = [];
      render();
      if (aiMode && state.turn === aiSide) setTimeout(runAiTurn, 500);
    }

    getResetButton().addEventListener('click', newGame);

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    newGame();
    return { dispose: () => window.removeEventListener('arcade:themechange', onTheme) };
  },
};
