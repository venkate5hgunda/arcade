import { CONNECTIONS_PUZZLES } from '../data/connections.ts';

export interface ConnectionsState {
  puzzleId: string;
  date: string | null;
  guesses: number[][];
}
export const CONNECTIONS_HELP =
  'Find four groups of four words that share a connection. Select four words, then submit. You have four mistakes; a repeated guess costs nothing. Shuffle to see a fresh arrangement. Play solo, solve together on one device, or join a cooperative private room with 2–20 players. Room players share solved groups and mistakes; selections stay on your own screen. Everyone can submit when all players are connected. Spectators can watch.';

export function dateKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function dailyPuzzle(date: string) {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  return CONNECTIONS_PUZZLES[
    ((day % CONNECTIONS_PUZZLES.length) + CONNECTIONS_PUZZLES.length) %
      CONNECTIONS_PUZZLES.length
  ];
}
export function newConnections(
  mode = 'daily',
  now = new Date(),
  random = Math.random,
): ConnectionsState {
  const date = mode === 'practice' ? null : dateKey(now);
  const puzzle = date
    ? dailyPuzzle(date)
    : CONNECTIONS_PUZZLES[Math.floor(random() * CONNECTIONS_PUZZLES.length)];
  return { puzzleId: puzzle.id, date, guesses: [] };
}
export function connectionsPuzzle(state: ConnectionsState) {
  return CONNECTIONS_PUZZLES.find((puzzle) => puzzle.id === state.puzzleId)!;
}
export function guessGroup(guess: number[]): number | null {
  const group = Math.floor(guess[0] / 4);
  return guess.every((word) => Math.floor(word / 4) === group) ? group : null;
}
export function connectionsProgress(state: ConnectionsState) {
  const solved = state.guesses.flatMap((guess) => {
    const group = guessGroup(guess);
    return group === null ? [] : [group];
  });
  const mistakes = state.guesses.length - solved.length;
  return {
    solved,
    mistakes,
    won: solved.length === 4,
    over: solved.length === 4 || mistakes === 4,
  };
}
const sameGuess = (a: number[], b: number[]) =>
  a.length === b.length && a.every((word) => b.includes(word));

export function submitConnections(
  state: ConnectionsState,
  input: unknown,
): { state: ConnectionsState; message: string } {
  if (connectionsProgress(state).over)
    return { state, message: 'This puzzle is finished.' };
  if (
    !Array.isArray(input) ||
    input.length !== 4 ||
    new Set(input).size !== 4 ||
    !input.every((word) => Number.isInteger(word) && word >= 0 && word < 16)
  )
    return { state, message: 'Select four different words.' };
  const guess = [...input].sort((a, b) => a - b);
  const { solved } = connectionsProgress(state);
  if (guess.some((word) => solved.includes(Math.floor(word / 4))))
    return { state, message: 'Those words have already been solved.' };
  if (state.guesses.some((previous) => sameGuess(previous, guess)))
    return { state, message: 'Already tried. Choose another group.' };
  const group = guessGroup(guess);
  const next = { ...state, guesses: [...state.guesses, guess] };
  const oneAway = [0, 1, 2, 3].some(
    (g) => guess.filter((word) => Math.floor(word / 4) === g).length === 3,
  );
  return {
    state: next,
    message:
      group !== null
        ? 'Connection found!'
        : oneAway
          ? 'One away! Try a different combination.'
          : 'Not a group. Try again.',
  };
}

/** Replay saved guesses so malformed, duplicate and post-result moves never resume. */
export function validConnections(
  value: unknown,
  allowFinished = false,
): value is ConnectionsState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as ConnectionsState;
  if (
    Object.keys(state).sort().join() !== 'date,guesses,puzzleId' ||
    !CONNECTIONS_PUZZLES.some((p) => p.id === state.puzzleId) ||
    !Array.isArray(state.guesses) ||
    state.guesses.length > 7
  )
    return false;
  if (
    state.date !== null &&
    (typeof state.date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(state.date) ||
      !Number.isFinite(Date.parse(`${state.date}T00:00:00Z`)) ||
      new Date(`${state.date}T00:00:00Z`).toISOString().slice(0, 10) !==
        state.date ||
      dailyPuzzle(state.date).id !== state.puzzleId)
  )
    return false;
  let replay: ConnectionsState = { ...state, guesses: [] };
  for (const guess of state.guesses) {
    const next = submitConnections(replay, guess).state;
    if (next === replay) return false;
    replay = next;
  }
  return allowFinished || !connectionsProgress(replay).over;
}
