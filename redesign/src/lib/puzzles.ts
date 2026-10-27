/** Pure puzzle transitions. Serialized field names match the baseline games. */
import type { LocalState } from './tictactoe.ts';
export type Random = () => number;
export type PuzzleId =
  | 'connect-four'
  | 'minesweeper'
  | 'memory'
  | '2048'
  | 'simon';
export const PUZZLE_IDS: PuzzleId[] = [
  'connect-four',
  'minesweeper',
  'memory',
  '2048',
  'simon',
];
export function shuffle<T>(values: T[], random: Random = Math.random): T[] {
  const result = values.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
const object = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number =>
  Number.isSafeInteger(v) && (v as number) >= 0;

export function c4Win(board: number[], player?: number): number[] | null {
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 7; c++) {
      const value = board[r * 7 + c];
      if (!value || (player && value !== player)) continue;
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
        [1, 1],
        [-1, 1],
      ]) {
        const line = Array.from({ length: 4 }, (_, n) => [
          r + n * dr,
          c + n * dc,
        ]);
        if (
          line.every(
            ([y, x]) =>
              y >= 0 && y < 6 && x >= 0 && x < 7 && board[y * 7 + x] === value,
          )
        )
          return line.map(([y, x]) => y * 7 + x);
      }
    }
  return null;
}
export function c4Row(board: number[], col: number): number {
  if (!Number.isInteger(col) || col < 0 || col > 6) return -1;
  for (let r = 5; r >= 0; r--) if (!board[r * 7 + col]) return r;
  return -1;
}
export function c4Drop(state: LocalState, col: number): LocalState {
  const row = c4Row(state.board, col);
  if (state.over || row < 0 || c4Win(state.board))
    throw new RangeError('Choose an open column.');
  const board = state.board.slice();
  board[row * 7 + col] = state.current as 1 | 2;
  const over = !!c4Win(board) || !board.includes(0);
  return {
    mode: state.mode,
    board,
    current: over ? state.current : 3 - state.current,
    over,
  };
}
export function c4AI(
  board: LocalState['board'],
  random: Random = Math.random,
): number {
  const open = Array.from({ length: 7 }, (_, c) => c).filter(
    (c) => c4Row(board, c) >= 0,
  );
  for (const token of [2, 1])
    for (const col of open) {
      const next = board.slice();
      next[c4Row(board, col) * 7 + col] = token as 1 | 2;
      if (c4Win(next, token)) return col;
    }
  const weighted = open.flatMap((c) => Array(4 - Math.abs(c - 3)).fill(c));
  return weighted[Math.floor(random() * weighted.length)] ?? -1;
}
export function validC4(s: unknown, allowFinished = false): s is LocalState {
  if (
    !object(s) ||
    !['ai', 'pvp'].includes(s.mode) ||
    !Array.isArray(s.board) ||
    s.board.length !== 42 ||
    !s.board.every((v: unknown) => [0, 1, 2].includes(v as number)) ||
    ![1, 2].includes(s.current)
  )
    return false;
  const x = s.board.filter((v: number) => v === 1).length,
    o = s.board.filter((v: number) => v === 2).length;
  const red = c4Win(s.board, 1),
    gold = c4Win(s.board, 2),
    finished = !!(red || gold) || !s.board.includes(0);
  if (
    x < o ||
    x > o + 1 ||
    s.current !== (finished ? (x === o ? 2 : 1) : x === o ? 1 : 2) ||
    (finished ? !allowFinished || s.over !== true : s.over === true) ||
    (red && s.current !== 1) ||
    (gold && s.current !== 2) ||
    (red && gold)
  )
    return false;
  for (let c = 0; c < 7; c++)
    for (let r = 0; r < 5; r++)
      if (s.board[r * 7 + c] && !s.board[(r + 1) * 7 + c]) return false;
  return true;
}

export type Direction = 'left' | 'right' | 'up' | 'down';
export interface TileState {
  grid: number[][];
  score: number;
  won: boolean;
  keepPlaying: boolean;
  over?: boolean;
}
export function tileMove(grid: number[][], dir: Direction) {
  const SIZE = 4;
  const coordinate = {
    left: (line: number, offset: number) => [line, offset],
    right: (line: number, offset: number) => [line, SIZE - 1 - offset],
    up: (line: number, offset: number) => [offset, line],
    down: (line: number, offset: number) => [SIZE - 1 - offset, line],
  }[dir];
  if (!coordinate) throw new RangeError(`Unknown direction: ${dir}`);
  const result = Array.from({ length: 4 }, () => Array<number>(4).fill(0));
  const tiles = [];
  const merges = [];
  let gained = 0;
  for (let line = 0; line < SIZE; line++) {
    let target = 0;
    let lastMerged = false;
    for (let offset = 0; offset < SIZE; offset++) {
      const [r, c] = coordinate(line, offset);
      const value = grid[r][c];
      if (!value) continue;
      const [tr, tc] = coordinate(line, target);
      const previous = target > 0 ? coordinate(line, target - 1) : null;
      if (
        previous &&
        !lastMerged &&
        result[previous[0]][previous[1]] === value
      ) {
        const [pr, pc] = previous;
        result[pr][pc] *= 2;
        gained += result[pr][pc];
        tiles.push({ r, c, tr: pr, tc: pc, value });
        merges.push({ r: pr, c: pc });
        lastMerged = true;
      } else {
        result[tr][tc] = value;
        tiles.push({ r, c, tr, tc, value });
        target++;
        lastMerged = false;
      }
    }
  }
  return { grid: result, gained, tiles, merges };
}

export function tileSpawn(
  grid: number[][],
  random: Random = Math.random,
): number[][] {
  const next = grid.map((row) => row.slice());
  const empty = next.flatMap((row, r) =>
    row.flatMap((v, c) => (v === 0 ? [[r, c]] : [])),
  );
  if (empty.length) {
    const [r, c] = empty[Math.floor(random() * empty.length)];
    next[r][c] = random() < 0.9 ? 2 : 4;
  }
  return next;
}
export function tileHasMoves(grid: number[][]): boolean {
  return grid.some((row, r) =>
    row.some(
      (v, c) =>
        !v || (c < 3 && v === row[c + 1]) || (r < 3 && v === grid[r + 1][c]),
    ),
  );
}
export function validTiles(s: unknown): s is TileState {
  return (
    object(s) &&
    Array.isArray(s.grid) &&
    s.grid.length === 4 &&
    s.grid.every(
      (row: unknown) =>
        Array.isArray(row) &&
        row.length === 4 &&
        row.every(
          (v) =>
            integer(v) &&
            (v === 0 || (v >= 2 && Number.isInteger(Math.log2(v)))),
        ),
    ) &&
    integer(s.score) &&
    typeof s.won === 'boolean' &&
    typeof s.keepPlaying === 'boolean' &&
    (!s.keepPlaying || s.won) &&
    s.grid.some((r: number[]) => r.some(Boolean)) &&
    s.won === s.grid.some((r: number[]) => r.some((v) => v >= 2048)) &&
    tileHasMoves(s.grid) &&
    !s.over
  );
}

export const DIFFICULTIES = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard: { rows: 16, cols: 30, mines: 99 },
} as const;
export interface MineCell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  count: number;
}
export interface MineState {
  difficulty: keyof typeof DIFFICULTIES;
  board: MineCell[];
  firstClick: boolean;
  flagMode: boolean;
  over?: boolean;
  won?: boolean;
}
export function neighbors(index: number, rows: number, cols: number): number[] {
  const r = Math.floor(index / cols),
    c = index % cols;
  const result: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++)
      if (
        (dr || dc) &&
        r + dr >= 0 &&
        r + dr < rows &&
        c + dc >= 0 &&
        c + dc < cols
      )
        result.push((r + dr) * cols + c + dc);
  return result;
}
export function mineInitial(difficulty: MineState['difficulty']): MineState {
  const { rows, cols } = DIFFICULTIES[difficulty];
  return {
    difficulty,
    board: Array.from({ length: rows * cols }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      count: 0,
    })),
    firstClick: true,
    flagMode: false,
  };
}
export function mineReveal(
  state: MineState,
  index: number,
  flag = false,
  random: Random = Math.random,
): MineState {
  if (state.over || !Number.isInteger(index) || !state.board[index])
    return state;
  const next = structuredClone(state);
  const { rows, cols, mines } = DIFFICULTIES[next.difficulty];
  if (next.board[index].revealed) return state;
  if (flag) {
    next.board[index].flagged = !next.board[index].flagged;
    return next;
  }
  if (next.board[index].flagged) return state;
  if (next.firstClick) {
    const safe = new Set([index, ...neighbors(index, rows, cols)]);
    const positions = shuffle(
      next.board.map((_, n) => n).filter((n) => !safe.has(n)),
      random,
    );
    positions.slice(0, mines).forEach((n) => {
      next.board[n].mine = true;
    });
    next.board.forEach((cell, n) => {
      cell.count = cell.mine
        ? 0
        : neighbors(n, rows, cols).filter((i) => next.board[i].mine).length;
    });
    next.firstClick = false;
  }
  if (next.board[index].mine) {
    next.over = true;
    next.won = false;
    next.board.forEach((c) => {
      if (c.mine) c.revealed = true;
    });
    return next;
  }
  const queue = [index];
  while (queue.length) {
    const n = queue.pop()!,
      cell = next.board[n];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    if (!cell.count) queue.push(...neighbors(n, rows, cols));
  }
  if (next.board.every((c) => c.revealed || c.mine)) {
    next.over = true;
    next.won = true;
    next.board.forEach((c) => {
      if (c.mine) c.flagged = true;
    });
  }
  return next;
}
export function validMines(s: unknown): s is MineState {
  if (
    !object(s) ||
    !Object.hasOwn(DIFFICULTIES, s.difficulty) ||
    typeof s.firstClick !== 'boolean' ||
    typeof s.flagMode !== 'boolean' ||
    !Array.isArray(s.board) ||
    s.over
  )
    return false;
  const { rows, cols, mines } =
    DIFFICULTIES[s.difficulty as MineState['difficulty']];
  if (
    s.board.length !== rows * cols ||
    !s.board.every(
      (c: any) =>
        object(c) &&
        typeof c.mine === 'boolean' &&
        typeof c.revealed === 'boolean' &&
        typeof c.flagged === 'boolean' &&
        integer(c.count) &&
        c.count <= 8 &&
        !(c.flagged && c.revealed),
    ) ||
    s.board.some((c: MineCell) => c.mine && c.revealed) ||
    s.board.every((c: MineCell) => c.mine || c.revealed)
  )
    return false;
  if (s.firstClick)
    return s.board.every((c: MineCell) => !c.mine && !c.revealed && !c.count);
  return (
    s.board.filter((c: MineCell) => c.mine).length === mines &&
    s.board.some((c: MineCell) => c.revealed) &&
    s.board.every(
      (c: MineCell, n: number) =>
        c.count ===
        (c.mine
          ? 0
          : neighbors(n, rows, cols).filter((i) => s.board[i].mine).length),
    )
  );
}

export const SYMBOLS = [
  '🍎',
  '🍌',
  '🍇',
  '🍓',
  '🥝',
  '🍋',
  '🥭',
  '🍒',
  '🥥',
  '🍍',
  '🥑',
  '🥕',
  '🌽',
  '🥔',
  '🍅',
  '🥦',
  '🧄',
  '🧅',
  '🥜',
  '🌰',
  '🍞',
  '🥐',
  '🥖',
  '🥨',
  '🧀',
  '🥚',
  '🍳',
  '🥞',
  '🧇',
  '🥓',
  '🥩',
  '🍗',
];
export interface MemoryCard {
  index: number;
  symbol: string;
  revealed: boolean;
  matched: boolean;
}
export interface MemoryState {
  size: '4' | '6' | '8';
  players: '1' | '2';
  cards: MemoryCard[];
  firstPick: number | null;
  current: number;
  scores: Record<number, number>;
  over?: boolean;
}
export function memoryInitial(
  size: MemoryState['size'],
  players: MemoryState['players'],
  random: Random = Math.random,
): MemoryState {
  return {
    size,
    players,
    cards: shuffle(
      SYMBOLS.slice(0, Number(size) ** 2 / 2).flatMap((symbol) => [
        symbol,
        symbol,
      ]),
      random,
    ).map((symbol, index) => ({
      index,
      symbol,
      revealed: false,
      matched: false,
    })),
    firstPick: null,
    current: 1,
    scores: { 1: 0, 2: 0 },
  };
}
export function memoryFlip(
  s: MemoryState,
  index: number,
): { state: MemoryState; mismatch: number[] | null } {
  if (s.over || !s.cards[index] || s.cards[index].revealed)
    return { state: s, mismatch: null };
  const next = structuredClone(s);
  next.cards[index].revealed = true;
  if (next.firstPick === null) {
    next.firstPick = index;
    return { state: next, mismatch: null };
  }
  const first = next.firstPick;
  if (next.cards[first].symbol !== next.cards[index].symbol)
    return { state: next, mismatch: [first, index] };
  next.cards[first].matched = next.cards[index].matched = true;
  next.firstPick = null;
  next.scores[next.current]++;
  next.over = next.cards.every((c) => c.matched);
  return { state: next, mismatch: null };
}
export function memoryHide(s: MemoryState, pair: number[]): MemoryState {
  const next = structuredClone(s);
  pair.forEach((n) => {
    next.cards[n].revealed = false;
  });
  next.firstPick = null;
  if (next.players === '2') next.current = 3 - next.current;
  return next;
}
export function validMemory(s: unknown): s is MemoryState {
  if (
    !object(s) ||
    !['4', '6', '8'].includes(s.size) ||
    !['1', '2'].includes(s.players) ||
    !Array.isArray(s.cards) ||
    s.cards.length !== Number(s.size) ** 2 ||
    ![1, 2].includes(s.current) ||
    (s.players === '1' && s.current !== 1) ||
    !object(s.scores) ||
    !integer(s.scores[1]) ||
    !integer(s.scores[2]) ||
    (s.players === '1' && s.scores[2] !== 0) ||
    s.over
  )
    return false;
  if (
    s.firstPick !== null &&
    (!integer(s.firstPick) || s.firstPick >= s.cards.length)
  )
    return false;
  const counts = new Map<string, number>();
  for (let n = 0; n < s.cards.length; n++) {
    const c = s.cards[n];
    if (
      !object(c) ||
      c.index !== n ||
      !SYMBOLS.slice(0, s.cards.length / 2).includes(c.symbol) ||
      typeof c.revealed !== 'boolean' ||
      typeof c.matched !== 'boolean' ||
      (c.matched && !c.revealed) ||
      (c.revealed && !c.matched && n !== s.firstPick)
    )
      return false;
    counts.set(c.symbol, (counts.get(c.symbol) ?? 0) + 1);
  }
  return (
    counts.size === s.cards.length / 2 &&
    [...counts.values()].every((n) => n === 2) &&
    s.cards.every((c: MemoryCard) =>
      s.cards
        .filter((other: MemoryCard) => other.symbol === c.symbol)
        .every((other: MemoryCard) => other.matched === c.matched),
    ) &&
    (s.firstPick === null ||
      (s.cards[s.firstPick].revealed && !s.cards[s.firstPick].matched)) &&
    s.cards.filter((c: MemoryCard) => c.matched).length ===
      2 * (s.scores[1] + s.scores[2]) &&
    s.scores[1] + s.scores[2] < s.cards.length / 2
  );
}
export interface SimonState {
  speed: 'slow' | 'normal' | 'fast';
  sequence: number[];
  playerStep: number;
  over?: boolean;
}
export function validSimon(s: unknown): s is SimonState {
  return (
    object(s) &&
    ['slow', 'normal', 'fast'].includes(s.speed) &&
    Array.isArray(s.sequence) &&
    s.sequence.length > 0 &&
    s.sequence.length <= 10_000 &&
    s.sequence.every((n: unknown) => integer(n) && n < 4) &&
    integer(s.playerStep) &&
    s.playerStep <= s.sequence.length &&
    !s.over
  );
}
export function simonPress(s: SimonState, pad: number): SimonState {
  if (
    s.over ||
    s.playerStep >= s.sequence.length ||
    !Number.isInteger(pad) ||
    pad < 0 ||
    pad > 3
  )
    return s;
  return {
    ...s,
    playerStep: s.playerStep + (pad === s.sequence[s.playerStep] ? 1 : 0),
    over: pad !== s.sequence[s.playerStep],
  };
}
export const puzzleValidators: Record<PuzzleId, (value: unknown) => boolean> = {
  'connect-four': validC4,
  minesweeper: validMines,
  memory: validMemory,
  '2048': validTiles,
  simon: validSimon,
};
