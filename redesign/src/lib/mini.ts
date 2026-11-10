import { MINI_CLUES, MINI_GRIDS } from '../data/mini.ts';
import { edition, int, object, unique, validEdition } from './daily.ts';
export interface MiniState {
  gameId: 'mini-crossword';
  seed: number;
  date: string | null;
  entries: string[];
  revealed: number[];
}
export function miniPuzzle(seed: number) {
  const rows = MINI_GRIDS[seed % MINI_GRIDS.length];
  return {
    answer: rows.join(''),
    across: rows.map((w, i) => ({
      number: i === 0 ? 1 : i + 5,
      clue: MINI_CLUES[w][0],
    })),
    down: rows.map((_, i) => ({
      number: i + 1,
      clue: MINI_CLUES[rows.map((w) => w[i]).join('')][1],
    })),
  };
}
export const newMini = (mode = 'daily'): MiniState => ({
  gameId: 'mini-crossword',
  ...edition(mode),
  entries: Array(25).fill(''),
  revealed: [],
});
export const miniDone = (s: MiniState) =>
  s.entries.join('') === miniPuzzle(s.seed).answer;
export function actMini(
  s: MiniState,
  input: unknown,
): { state: MiniState; message: string } {
  const fail = (message: string) => ({ state: s, message });
  if (miniDone(s) || !object(input) || !int(input.cell, 0, 24))
    return fail('Choose an editable cell.');
  const cell = input.cell;
  if (s.revealed.includes(cell)) return fail('Revealed letters are fixed.');
  let value = '';
  if (input.type === 'reveal') {
    value = miniPuzzle(s.seed).answer[cell];
    if (s.entries[cell] === value)
      return fail('That letter is already correct.');
  } else if (
    input.type === 'entry' &&
    typeof input.value === 'string' &&
    /^([A-Z])?$/.test(input.value)
  )
    value = input.value;
  else return fail('Enter one letter.');
  if (value === s.entries[cell]) return fail('No change.');
  const entries = [...s.entries];
  entries[cell] = value;
  return {
    state: {
      ...s,
      entries,
      revealed: input.type === 'reveal' ? [...s.revealed, cell] : s.revealed,
    },
    message: input.type === 'reveal' ? 'Letter revealed.' : 'Letter entered.',
  };
}
export function validMini(
  value: unknown,
  allowFinished = false,
): value is MiniState {
  if (!object(value)) return false;
  const s = value as unknown as MiniState;
  if (
    Object.keys(s).sort().join() !== 'date,entries,gameId,revealed,seed' ||
    s.gameId !== 'mini-crossword' ||
    !validEdition(s) ||
    !Array.isArray(s.entries) ||
    s.entries.length !== 25 ||
    !s.entries.every((c) => typeof c === 'string' && /^([A-Z])?$/.test(c)) ||
    !Array.isArray(s.revealed) ||
    s.revealed.length > 25 ||
    !unique(s.revealed) ||
    !s.revealed.every(
      (c) => int(c, 0, 24) && s.entries[c] === miniPuzzle(s.seed).answer[c],
    )
  )
    return false;
  return allowFinished || !miniDone(s);
}
