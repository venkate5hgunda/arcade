// Tic-Tac-Toe pure domain logic, ported from games/tictactoe.js.
// Kept free of DOM, storage and transport so it can be unit-tested and reused
// by both the local and room views.
//
// Board is a 9-cell array: 0 empty, 1 = X (player 1), 2 = O (player 2 / AI).
// `current` is the 1-based seat about to move.

export const N = 3;
export type Cell = 0 | 1 | 2;
export type Board = Cell[];
export type Mode = 'pvp' | 'ai';

export const TOKEN_STYLE: Record<1 | 2, { color: string; label: string }> = {
  1: { color: '#ff5a3c', label: 'X' },
  2: { color: '#38bdf8', label: 'O' },
};

export interface LocalState {
  mode: Mode;
  board: Board;
  current: number;
  over?: boolean;
}

export interface RoomState extends LocalState {
  mode: 'pvp';
  over: boolean;
  roundId: number;
}

export function emptyBoard(n = N): Board {
  return Array(n * n).fill(0) as Board;
}

export function nextPlayer(current: number, total: number): number {
  return current >= total ? 1 : current + 1;
}

export function lineComplete(board: Board, line: number[]): Cell | null {
  const [a, mid, c] = line;
  return board[a] && board[a] === board[mid] && board[a] === board[c]
    ? board[a]
    : null;
}

export function winLines(): number[][] {
  const lines: number[][] = [];
  for (let r = 0; r < N; r++) lines.push([r * N, r * N + 1, r * N + 2]);
  for (let c = 0; c < N; c++) lines.push([c, c + N, c + 2 * N]);
  lines.push([0, 4, 8], [2, 4, 6]);
  return lines;
}

export function findWin(board: Board): number[] | null {
  for (const line of winLines()) if (lineComplete(board, line)) return line;
  return null;
}

export function minimax(
  board: Board,
  isMax: boolean,
  aiToken: Cell,
  humanToken: Cell,
): number {
  const win = findWin(board);
  if (win) return board[win[0]] === aiToken ? 1 : -1;
  if (board.every((v) => v !== 0)) return 0;
  const cur: Cell = isMax ? aiToken : humanToken;
  let best = isMax ? -Infinity : Infinity;
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== 0) continue;
    board[i] = cur;
    const score = minimax(board, !isMax, aiToken, humanToken);
    board[i] = 0;
    best = isMax ? Math.max(best, score) : Math.min(best, score);
  }
  return best;
}

export function aiMove(board: Board, aiToken: Cell, humanToken: Cell): number {
  const moves = board
    .map((v, i) => (v === 0 ? i : null))
    .filter((v) => v !== null) as number[];
  if (moves.length === 0) return -1;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const b = board.slice();
    b[m] = aiToken;
    const score = minimax(b, false, aiToken, humanToken);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

/** Accept only reachable boards; finished room snapshots require an explicit flag. */
export function isValidState(
  s: LocalState | null | undefined,
  allowFinished = false,
): s is LocalState {
  if (
    !s ||
    typeof s !== 'object' ||
    Array.isArray(s) ||
    !['pvp', 'ai'].includes(s.mode) ||
    !Array.isArray(s.board) ||
    s.board.length !== 9 ||
    !s.board.every((v) => v === 0 || v === 1 || v === 2) ||
    ![1, 2].includes(s.current)
  )
    return false;
  const x = s.board.filter((v) => v === 1).length;
  const o = s.board.filter((v) => v === 2).length;
  const win = findWin(s.board);
  const finished = !!win || !s.board.includes(0);
  return (
    x >= o &&
    x <= o + 1 &&
    s.current === (finished ? (x === o ? 2 : 1) : x === o ? 1 : 2) &&
    (s.mode !== 'ai' || o <= x) &&
    (!finished || (allowFinished && s.over === true)) &&
    (finished || s.over !== true) &&
    (!win || s.board[win[0]] === s.current) &&
    ![1, 2].every((token) =>
      winLines().some((line) => lineComplete(s.board, line) === token),
    )
  );
}

export interface MoveResult {
  board: Board;
  current: number;
  win: number[] | null;
  finished: boolean;
}

/** Pure, authoritative move application used by the host to validate guest
 * intents and by local play. Does not mutate the input board. */
export function applyMove(
  board: Board,
  current: number,
  cell: number,
): MoveResult {
  if (
    board.length !== 9 ||
    ![1, 2].includes(current) ||
    findWin(board) ||
    !board.includes(0)
  )
    throw new RangeError('The board cannot accept a move.');
  if (
    !Number.isInteger(cell) ||
    cell < 0 ||
    cell >= board.length ||
    board[cell] !== 0
  )
    throw new RangeError('Illegal cell.');
  const next = board.slice();
  next[cell] = current as Cell;
  const win = findWin(next);
  const finished = !!win || !next.includes(0);
  return {
    board: next,
    current: finished ? current : nextPlayer(current, 2),
    win,
    finished,
  };
}
