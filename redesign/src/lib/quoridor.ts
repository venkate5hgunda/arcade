import { edition, int, object, validEdition } from './daily.ts';
export interface QuoridorWall {
  row: number;
  col: number;
  orientation: 'h' | 'v';
  owner: 0 | 1;
}
export interface QuoridorState {
  gameId: 'quoridor';
  seed: number;
  date: string | null;
  pawns: [number, number];
  walls: QuoridorWall[];
  current: 0 | 1;
  winner: 0 | 1 | null;
}
export const newQuoridor = (): QuoridorState => ({
  gameId: 'quoridor',
  ...edition('practice'),
  pawns: [4, 76],
  walls: [],
  current: 0,
  winner: null,
});
export const quoridorDone = (s: QuoridorState) => s.winner !== null;
export function quoridorEdge(a: number, b: number, walls: QuoridorWall[]) {
  if (!int(a, 0, 80) || !int(b, 0, 80)) return false;
  const ar = Math.floor(a / 9),
    br = Math.floor(b / 9),
    ac = a % 9,
    bc = b % 9;
  if (Math.abs(ar - br) + Math.abs(ac - bc) !== 1) return false;
  if (ar !== br)
    return !walls.some(
      (w) =>
        w.orientation === 'h' &&
        w.row === Math.min(ar, br) &&
        (w.col === ac || w.col + 1 === ac),
    );
  return !walls.some(
    (w) =>
      w.orientation === 'v' &&
      w.col === Math.min(ac, bc) &&
      (w.row === ar || w.row + 1 === ar),
  );
}
const neighbors = (cell: number, walls: QuoridorWall[]) =>
  [cell - 9, cell + 9, cell - 1, cell + 1].filter((n) =>
    quoridorEdge(cell, n, walls),
  );
export function quoridorPath(
  start: number,
  goalRow: number,
  walls: QuoridorWall[],
) {
  const queue = [start],
    seen = new Set(queue);
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    if (Math.floor(cell / 9) === goalRow) return true;
    for (const next of neighbors(cell, walls))
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
  }
  return false;
}
export function quoridorMoves(s: QuoridorState, seat = s.current) {
  if (s.winner !== null) return [];
  const from = s.pawns[seat],
    other = s.pawns[1 - seat],
    out: number[] = [];
  for (const cell of neighbors(from, s.walls)) {
    if (cell !== other) {
      out.push(cell);
      continue;
    }
    const behind = other + (other - from);
    if (quoridorEdge(other, behind, s.walls)) out.push(behind);
    else
      for (const side of neighbors(other, s.walls))
        if (
          side !== from &&
          (Math.floor(from / 9) !== Math.floor(other / 9)
            ? Math.floor(side / 9) === Math.floor(other / 9)
            : side % 9 === other % 9)
        )
          out.push(side);
  }
  return [...new Set(out)];
}
export const quoridorStock = (s: QuoridorState, seat: number) =>
  10 - s.walls.filter((w) => w.owner === seat).length;
function overlaps(a: QuoridorWall, b: QuoridorWall) {
  return a.orientation === b.orientation
    ? a.orientation === 'h'
      ? a.row === b.row && Math.abs(a.col - b.col) <= 1
      : a.col === b.col && Math.abs(a.row - b.row) <= 1
    : a.row === b.row && a.col === b.col;
}
export function quoridorWallError(
  s: QuoridorState,
  input: unknown,
): string | null {
  if (
    !object(input) ||
    !int(input.row, 0, 7) ||
    !int(input.col, 0, 7) ||
    !['h', 'v'].includes(input.orientation as string)
  )
    return 'Choose a wall anchor inside the board.';
  if (!quoridorStock(s, s.current)) return 'You have no walls left.';
  const wall = {
    row: input.row,
    col: input.col,
    orientation: input.orientation as 'h' | 'v',
    owner: s.current,
  };
  if (s.walls.some((w) => overlaps(w, wall)))
    return 'Walls may not overlap or cross.';
  const walls = [...s.walls, wall];
  if (
    !quoridorPath(s.pawns[0], 8, walls) ||
    !quoridorPath(s.pawns[1], 0, walls)
  )
    return 'Both players must keep a route to their goal edge.';
  return null;
}
export function actQuoridor(
  s: QuoridorState,
  input: unknown,
): { state: QuoridorState; message: string } {
  const fail = (message: string) => ({ state: s, message });
  if (s.winner !== null || !object(input))
    return fail('This match is finished.');
  if (input.type === 'move') {
    if (!int(input.cell, 0, 80) || !quoridorMoves(s).includes(input.cell))
      return fail('Choose a highlighted legal move.');
    const pawns = [...s.pawns] as [number, number];
    pawns[s.current] = input.cell;
    const winner =
      Math.floor(input.cell / 9) === (s.current === 0 ? 8 : 0)
        ? s.current
        : null;
    return {
      state: {
        ...s,
        pawns,
        current: winner === null ? ((1 - s.current) as 0 | 1) : s.current,
        winner,
      },
      message:
        winner === null
          ? 'Pawn moved.'
          : `Player ${winner + 1} reaches the goal!`,
    };
  }
  if (input.type === 'wall') {
    const error = quoridorWallError(s, input);
    if (error) return fail(error);
    return {
      state: {
        ...s,
        walls: [
          ...s.walls,
          {
            row: input.row as number,
            col: input.col as number,
            orientation: input.orientation as 'h' | 'v',
            owner: s.current,
          },
        ],
        current: (1 - s.current) as 0 | 1,
      },
      message: 'Wall placed. Both routes remain open.',
    };
  }
  return fail('Move your pawn or place a wall.');
}
export function validQuoridor(
  value: unknown,
  allowFinished = false,
): value is QuoridorState {
  if (!object(value)) return false;
  const s = value as unknown as QuoridorState;
  if (
    Object.keys(s).sort().join() !==
      'current,date,gameId,pawns,seed,walls,winner' ||
    s.gameId !== 'quoridor' ||
    !validEdition(s) ||
    s.date !== null ||
    !Array.isArray(s.pawns) ||
    s.pawns.length !== 2 ||
    !s.pawns.every((n) => int(n, 0, 80)) ||
    s.pawns[0] === s.pawns[1] ||
    !int(s.current, 0, 1) ||
    !Array.isArray(s.walls) ||
    s.walls.length > 20 ||
    !(s.winner === null || int(s.winner, 0, 1))
  )
    return false;
  for (let i = 0; i < s.walls.length; i++) {
    const w = s.walls[i];
    if (
      !object(w) ||
      Object.keys(w).sort().join() !== 'col,orientation,owner,row' ||
      !int(w.row, 0, 7) ||
      !int(w.col, 0, 7) ||
      !['h', 'v'].includes(w.orientation) ||
      !int(w.owner, 0, 1) ||
      s.walls.slice(0, i).some((other) => overlaps(w, other))
    )
      return false;
  }
  if (
    quoridorStock(s, 0) < 0 ||
    quoridorStock(s, 1) < 0 ||
    !quoridorPath(s.pawns[0], 8, s.walls) ||
    !quoridorPath(s.pawns[1], 0, s.walls)
  )
    return false;
  const a = Math.floor(s.pawns[0] / 9) === 8,
    b = Math.floor(s.pawns[1] / 9) === 0;
  if (a && b) return false;
  const winner = a ? 0 : b ? 1 : null;
  return (
    s.winner === winner &&
    (winner === null || s.current === winner) &&
    (allowFinished || winner === null)
  );
}
