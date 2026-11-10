import {
  edition,
  int,
  object,
  randomFor,
  shuffle,
  unique,
  validEdition,
} from './daily.ts';
export type SudokuDifficulty = 'easy' | 'medium' | 'hard';
export interface SudokuState {
  gameId: 'sudoku';
  seed: number;
  date: string | null;
  difficulty: SudokuDifficulty;
  values: number[];
  notes: number[][];
  revealed: number[];
}
export function sudokuSolutions(input: number[], limit = 2): number {
  if (
    !Array.isArray(input) ||
    input.length !== 81 ||
    !input.every((n) => int(n, 0, 9))
  )
    return 0;
  const board = [...input];
  let count = 0;
  function candidates(cell: number) {
    let mask = 0;
    const r = Math.floor(cell / 9),
      c = cell % 9;
    for (let i = 0; i < 9; i++) {
      mask |= 1 << board[r * 9 + i];
      mask |= 1 << board[i * 9 + c];
      mask |=
        1 <<
        board[
          (Math.floor(r / 3) * 3 + Math.floor(i / 3)) * 9 +
            Math.floor(c / 3) * 3 +
            (i % 3)
        ];
    }
    return Array.from({ length: 9 }, (_, i) => i + 1).filter(
      (n) => !(mask & (1 << n)),
    );
  }
  function solve() {
    if (count >= limit) return;
    let best = -1,
      options: number[] = [];
    for (let cell = 0; cell < 81; cell++)
      if (board[cell] === 0) {
        const choices = candidates(cell);
        if (!choices.length) return;
        if (best < 0 || choices.length < options.length) {
          best = cell;
          options = choices;
          if (options.length === 1) break;
        }
      }
    if (best < 0) {
      count++;
      return;
    }
    for (const n of options) {
      board[best] = n;
      solve();
      if (count >= limit) break;
    }
    board[best] = 0;
  }
  // Reject contradictory givens before searching.
  for (let cell = 0; cell < 81; cell++)
    if (board[cell]) {
      const n = board[cell];
      board[cell] = 0;
      if (!candidates(cell).includes(n)) return 0;
      board[cell] = n;
    }
  solve();
  return count;
}
const cache = new Map<string, { givens: number[]; solution: number[] }>();
export function sudokuPuzzle(seed: number, difficulty: SudokuDifficulty) {
  const key = `${seed}:${difficulty}`,
    saved = cache.get(key);
  if (saved) return saved;
  const random = randomFor(
    seed ^ { easy: 7183, medium: 15527, hard: 25913 }[difficulty],
  );
  const groups = [0, 1, 2];
  const order = () =>
    shuffle(groups, random).flatMap((group) =>
      shuffle(groups, random).map((i) => group * 3 + i),
    );
  const rows = order(),
    cols = order(),
    digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
  const solution = rows.flatMap((row) =>
      cols.map((col) => digits[(row * 3 + Math.floor(row / 3) + col) % 9]),
    ),
    givens = [...solution],
    target = { easy: 40, medium: 33, hard: 27 }[difficulty];
  let left = 81;
  for (const cell of shuffle(
    Array.from({ length: 81 }, (_, i) => i),
    random,
  )) {
    if (left <= target) break;
    const before = givens[cell];
    givens[cell] = 0;
    if (sudokuSolutions(givens) === 1) left--;
    else givens[cell] = before;
  }
  const puzzle = { givens, solution };
  if (cache.size >= 48) cache.delete(cache.keys().next().value!);
  cache.set(key, puzzle);
  return puzzle;
}
export function newSudoku(mode = 'daily', difficulty = 'easy'): SudokuState {
  const d: SudokuDifficulty = ['easy', 'medium', 'hard'].includes(difficulty)
      ? (difficulty as SudokuDifficulty)
      : 'easy',
    ed = edition(mode);
  return {
    gameId: 'sudoku',
    ...ed,
    difficulty: d,
    values: [...sudokuPuzzle(ed.seed, d).givens],
    notes: Array.from({ length: 81 }, () => []),
    revealed: [],
  };
}
export const sudokuDone = (s: SudokuState) =>
  s.values.every(
    (n, i) => n === sudokuPuzzle(s.seed, s.difficulty).solution[i],
  );
export function sudokuConflicts(s: SudokuState) {
  return s.values.flatMap((n, cell) =>
    n &&
    s.values.some(
      (m, other) =>
        other !== cell &&
        m === n &&
        (Math.floor(cell / 9) === Math.floor(other / 9) ||
          cell % 9 === other % 9 ||
          (Math.floor(cell / 27) === Math.floor(other / 27) &&
            Math.floor((cell % 9) / 3) === Math.floor((other % 9) / 3))),
    )
      ? [cell]
      : [],
  );
}
export function actSudoku(
  s: SudokuState,
  input: unknown,
): { state: SudokuState; message: string } {
  const fail = (message: string) => ({ state: s, message });
  if (sudokuDone(s) || !object(input) || !int(input.cell, 0, 80))
    return fail('Choose an editable cell.');
  const cell = input.cell,
    puzzle = sudokuPuzzle(s.seed, s.difficulty);
  if (puzzle.givens[cell] || s.revealed.includes(cell))
    return fail('Given and revealed cells are fixed.');
  const values = [...s.values],
    notes = s.notes.map((n) => [...n]);
  let revealed = s.revealed;
  if (input.type === 'hint') {
    values[cell] = puzzle.solution[cell];
    notes[cell] = [];
    revealed = [...s.revealed, cell];
  } else if (input.type === 'entry' && int(input.value, 0, 9)) {
    if (values[cell] === input.value && !notes[cell].length)
      return fail('No change.');
    values[cell] = input.value;
    notes[cell] = [];
  } else if (input.type === 'note' && int(input.value, 1, 9)) {
    if (values[cell]) return fail('Clear the cell before adding pencil notes.');
    notes[cell] = notes[cell].includes(input.value)
      ? notes[cell].filter((n) => n !== input.value)
      : [...notes[cell], input.value].sort();
  } else return fail('Choose a digit from 1 to 9.');
  return {
    state: { ...s, values, notes, revealed },
    message:
      input.type === 'hint'
        ? 'Cell revealed. Assistance is recorded.'
        : input.type === 'note'
          ? 'Pencil notes updated.'
          : 'Cell updated.',
  };
}
export function validSudoku(
  value: unknown,
  allowFinished = false,
): value is SudokuState {
  if (!object(value)) return false;
  const s = value as unknown as SudokuState;
  if (
    Object.keys(s).sort().join() !==
      'date,difficulty,gameId,notes,revealed,seed,values' ||
    s.gameId !== 'sudoku' ||
    !validEdition(s) ||
    !['easy', 'medium', 'hard'].includes(s.difficulty) ||
    !Array.isArray(s.values) ||
    s.values.length !== 81 ||
    !s.values.every((n) => int(n, 0, 9)) ||
    !Array.isArray(s.notes) ||
    s.notes.length !== 81 ||
    !s.notes.every(
      (n) =>
        Array.isArray(n) &&
        n.length <= 9 &&
        unique(n) &&
        n.every((x) => int(x, 1, 9)),
    ) ||
    !Array.isArray(s.revealed) ||
    s.revealed.length > 81 ||
    !unique(s.revealed) ||
    !s.revealed.every((n) => int(n, 0, 80))
  )
    return false;
  const p = sudokuPuzzle(s.seed, s.difficulty);
  if (
    s.values.some(
      (n, i) => (p.givens[i] && n !== p.givens[i]) || (n && s.notes[i].length),
    )
  )
    return false;
  if (s.revealed.some((i) => s.values[i] !== p.solution[i] || p.givens[i]))
    return false;
  return allowFinished || !sudokuDone(s);
}
