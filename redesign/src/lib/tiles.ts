import {
  edition,
  int,
  object,
  randomFor,
  shuffle,
  validEdition,
} from './daily.ts';
export interface TilesState {
  gameId: 'tiles';
  seed: number;
  date: string | null;
  players: number;
  moves: [number, number][];
}
export function tilesBoard(seed: number) {
  const random = randomFor(seed);
  const pairs = Array.from({ length: 6 }, () =>
    Array.from({ length: 3 }, () => Math.floor(random() * 4)),
  );
  return shuffle(
    pairs.flatMap((p) => [[...p], [...p]]),
    random,
  );
}
export function matchTiles(
  board: number[][],
  pair: unknown,
): number[][] | null {
  if (
    !Array.isArray(pair) ||
    pair.length !== 2 ||
    !pair.every((n) => int(n, 0, 11)) ||
    pair[0] === pair[1]
  )
    return null;
  const [a, b] = pair;
  if (!board[a].some((n) => n >= 0) || !board[b].some((n) => n >= 0))
    return null;
  const layers = [0, 1, 2].filter(
    (i) => board[a][i] >= 0 && board[a][i] === board[b][i],
  );
  if (!layers.length) return null;
  return board.map((tile, i) =>
    i === a || i === b
      ? tile.map((n, layer) => (layers.includes(layer) ? -1 : n))
      : [...tile],
  );
}
export function tilesProgress(s: TilesState) {
  let board = tilesBoard(s.seed),
    score = 0,
    combo = 0,
    anchor: number | null = null;
  for (const pair of s.moves) {
    const next = matchTiles(board, pair);
    if (!next) break;
    const removed =
      board.flat().filter((n) => n >= 0).length -
      next.flat().filter((n) => n >= 0).length;
    combo = anchor !== null && pair.includes(anchor) ? combo + 1 : 1;
    score += removed * combo;
    anchor = next[pair[1]].some((n) => n >= 0)
      ? pair[1]
      : next[pair[0]].some((n) => n >= 0)
        ? pair[0]
        : null;
    board = next;
  }
  return {
    board,
    score,
    combo,
    anchor,
    remaining: board.flat().filter((n) => n >= 0).length,
    done: board.every((tile) => tile.every((n) => n < 0)),
  };
}
export const newTiles = (mode = 'daily', players = 1): TilesState => ({
  gameId: 'tiles',
  ...edition(mode),
  players: int(players, 1, 20) ? players : 1,
  moves: [],
});
export const tilesDone = (s: TilesState) => tilesProgress(s).done;
export function actTiles(
  s: TilesState,
  input: unknown,
): { state: TilesState; message: string } {
  const p = tilesProgress(s);
  if (
    p.done ||
    !object(input) ||
    input.type !== 'match' ||
    !matchTiles(p.board, input.tiles)
  )
    return {
      state: s,
      message: 'Choose two different tiles sharing a ring, shape or pattern.',
    };
  const pair = input.tiles as [number, number],
    next = { ...s, moves: [...s.moves, [...pair] as [number, number]] };
  return {
    state: next,
    message: tilesDone(next)
      ? 'Every layer matched!'
      : `Match! ${tilesProgress(next).combo}× combo`,
  };
}
export function validTiles(
  value: unknown,
  allowFinished = false,
): value is TilesState {
  if (!object(value)) return false;
  const s = value as unknown as TilesState;
  if (
    Object.keys(s).sort().join() !== 'date,gameId,moves,players,seed' ||
    s.gameId !== 'tiles' ||
    !validEdition(s) ||
    !int(s.players, 1, 20) ||
    !Array.isArray(s.moves) ||
    s.moves.length > 18
  )
    return false;
  let board = tilesBoard(s.seed);
  for (const pair of s.moves) {
    const next = matchTiles(board, pair);
    if (!next) return false;
    board = next;
  }
  return allowFinished || !tilesDone(s);
}
