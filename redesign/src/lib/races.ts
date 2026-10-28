import { createBoardLayout } from './snakes-board.ts';
import type { Random } from './puzzles.ts';
export type RaceId = 'snakes-ladders' | 'ludo';
export interface SnakesState {
  playerCount: number;
  seed: string;
  positions: number[];
  current: number;
  lastRoll: number;
  message: string;
  winner: number | null;
}
export interface LudoState {
  count: number;
  tokens: number[][];
  current: number;
  value: number;
  awaiting: boolean;
  movable: number[];
  winner: number | null;
  message: string;
}
export type RaceState =
  | { gameId: 'snakes-ladders'; state: SnakesState }
  | { gameId: 'ludo'; state: LudoState };
export const SAFE_TRACK = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export function legalMoves(positions: number[], roll: number) {
  return positions.flatMap((pos, index) =>
    (pos === -1 ? roll === 6 : pos < 58 && pos + roll <= 58) ? [index] : [],
  );
}
export function validSnakes(
  value: unknown,
  allowFinished = false,
): value is SnakesState {
  const s = value as SnakesState;
  return (
    !!s &&
    typeof s === 'object' &&
    Number.isInteger(s.playerCount) &&
    s.playerCount >= 2 &&
    s.playerCount <= 4 &&
    typeof s.seed === 'string' &&
    s.seed.length > 0 &&
    s.seed.length <= 48 &&
    Array.isArray(s.positions) &&
    s.positions.length === s.playerCount &&
    s.positions.every((n) => Number.isInteger(n) && n >= 0 && n <= 100) &&
    Number.isInteger(s.current) &&
    s.current >= 0 &&
    s.current < s.playerCount &&
    Number.isInteger(s.lastRoll) &&
    s.lastRoll >= 1 &&
    s.lastRoll <= 6 &&
    typeof s.message === 'string' &&
    s.message.length <= 160 &&
    (s.positions.includes(100)
      ? allowFinished &&
        Number.isInteger(s.winner) &&
        s.winner !== null &&
        s.positions[s.winner] === 100 &&
        s.positions.filter((n) => n === 100).length === 1
      : s.winner == null)
  );
}
export function validLudo(
  value: unknown,
  allowFinished = false,
): value is LudoState {
  const s = value as LudoState;
  if (
    !s ||
    typeof s !== 'object' ||
    !Number.isInteger(s.count) ||
    s.count < 2 ||
    s.count > 4 ||
    !Array.isArray(s.tokens) ||
    s.tokens.length !== s.count ||
    s.tokens.some(
      (group) =>
        !Array.isArray(group) ||
        group.length !== 4 ||
        group.some((n) => !Number.isInteger(n) || n < -1 || n > 58),
    ) ||
    !Number.isInteger(s.current) ||
    s.current < 0 ||
    s.current >= s.count ||
    !Number.isInteger(s.value) ||
    s.value < 1 ||
    s.value > 6 ||
    typeof s.awaiting !== 'boolean' ||
    !Array.isArray(s.movable) ||
    s.movable.some((n) => !Number.isInteger(n) || n < 0 || n > 3) ||
    s.movable.length !== new Set(s.movable).size ||
    (!allowFinished &&
      s.tokens.some((group) => group.every((n) => n === 58))) ||
    !(
      (s.winner === null &&
        !s.tokens.some((group) => group.every((n) => n === 58))) ||
      (allowFinished &&
        Number.isInteger(s.winner) &&
        s.winner !== null &&
        s.winner >= 0 &&
        s.winner < s.count &&
        s.tokens[s.winner].every((n) => n === 58))
    ) ||
    typeof s.message !== 'string' ||
    s.message.length > 160
  )
    return false;
  if (s.winner !== null) return !s.awaiting && s.movable.length === 0;
  const expected = legalMoves(s.tokens[s.current], s.value);
  return s.awaiting
    ? expected.length > 0 &&
        expected.length === s.movable.length &&
        expected.every((n) => s.movable.includes(n))
    : s.movable.length === 0;
}
export function newRace(
  gameId: RaceId,
  count: number,
  seed: string = crypto.randomUUID(),
): RaceState {
  if (!Number.isInteger(count) || count < 2 || count > 4)
    throw new RangeError('Choose 2–4 players.');
  return gameId === 'snakes-ladders'
    ? {
        gameId,
        state: {
          playerCount: count,
          seed,
          positions: Array(count).fill(0),
          current: 0,
          lastRoll: 1,
          message: '',
          winner: null,
        },
      }
    : {
        gameId,
        state: {
          count,
          tokens: Array.from({ length: count }, () => Array(4).fill(-1)),
          current: 0,
          value: 1,
          awaiting: false,
          movable: [],
          winner: null,
          message: '',
        },
      };
}
export function validRace(
  value: unknown,
  finished = false,
): value is RaceState {
  if (!value || typeof value !== 'object' || Object.keys(value).length !== 2)
    return false;
  const s = value as RaceState;
  const keys =
    s.gameId === 'snakes-ladders'
      ? [
          'playerCount',
          'seed',
          'positions',
          'current',
          'lastRoll',
          'message',
          'winner',
        ]
      : [
          'count',
          'tokens',
          'current',
          'value',
          'awaiting',
          'movable',
          'winner',
          'message',
        ];
  if (
    !s.state ||
    typeof s.state !== 'object' ||
    !Object.keys(s.state).every((k) => keys.includes(k))
  )
    return false;
  return s.gameId === 'snakes-ladders'
    ? validSnakes(s.state, finished)
    : s.gameId === 'ludo' && validLudo(s.state, finished);
}
export const raceCount = (s: RaceState) =>
  s.gameId === 'ludo' ? s.state.count : s.state.playerCount;
export const wrapRace = (
  id: RaceId,
  state: SnakesState | LudoState,
): RaceState =>
  ({
    gameId: id,
    state:
      id === 'snakes-ladders'
        ? { ...state, winner: state.winner ?? null }
        : state,
  }) as RaceState;
export function secureRandom() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] / 0x100000000;
}
function ludoMove(s: LudoState, index: number) {
  const player = s.current,
    old = s.tokens[player][index],
    next = old === -1 ? 0 : old + s.value;
  let captured = 0;
  if (next < 52) {
    const square = (player * 13 + next) % 52;
    if (!SAFE_TRACK.has(square))
      for (let p = 0; p < s.count; p++)
        if (p !== player)
          for (let t = 0; t < 4; t++) {
            const progress = s.tokens[p][t];
            if (
              progress >= 0 &&
              progress < 52 &&
              (p * 13 + progress) % 52 === square
            ) {
              s.tokens[p][t] = -1;
              captured++;
            }
          }
  }
  s.tokens[player][index] = next;
  if (s.tokens[player].every((n) => n === 58)) s.winner = player;
  s.message = captured
    ? `Player ${player + 1} captured ${captured === 1 ? 'a token' : `${captured} tokens`} and rolls again.`
    : next === 58
      ? `Player ${player + 1} brought a token home!`
      : '';
  s.awaiting = false;
  s.movable = [];
  if (s.winner === null && s.value !== 6 && !captured)
    s.current = (player + 1) % s.count;
}
/** Transitions clone the state; an action cannot supply or choose its own die result. */
export function applyRace(
  value: RaceState,
  input: unknown,
  actor: number,
  random: Random = secureRandom,
): RaceState | null {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    value.state.winner != null ||
    value.state.current !== actor
  )
    return null;
  const action = input as Record<string, unknown>;
  const isRoll = action.type === 'roll' && Object.keys(action).length === 1;
  const isMove =
    action.type === 'move' &&
    Object.keys(action).length === 2 &&
    Number.isInteger(action.index);
  if (!isRoll && !isMove) return null;
  const next = structuredClone(value);
  if (next.gameId === 'snakes-ladders') {
    if (!isRoll) return null;
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1)
      throw new RangeError('Invalid die source.');
    const die = 1 + Math.floor(sample * 6),
      s = next.state,
      player = s.current,
      from = s.positions[player],
      rolled = from + die;
    s.lastRoll = die;
    if (rolled > 100)
      s.message = `Player ${player + 1} rolled ${die} · Exact roll needed for 100`;
    else {
      const layout = createBoardLayout(s.seed),
        snake = layout.snakes.find((item) => item.start === rolled),
        ladder = layout.ladders.find((item) => item.start === rolled);
      s.positions[player] = snake?.end ?? ladder?.end ?? rolled;
      s.message = snake
        ? `Player ${player + 1} slides from ${rolled} to ${snake.end}.`
        : ladder
          ? `Player ${player + 1} climbs from ${rolled} to ${ladder.end}.`
          : `Player ${player + 1} rolled ${die} · Now on square ${rolled}.`;
    }
    if (s.positions[player] === 100) s.winner = player;
    else s.current = (player + 1) % s.playerCount;
    return next;
  }
  const s = next.state;
  if (isMove) {
    const index = action.index as number;
    if (!s.awaiting || !s.movable.includes(index)) return null;
    ludoMove(s, index);
    return next;
  }
  if (s.awaiting) return null;
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1)
    throw new RangeError('Invalid die source.');
  s.value = 1 + Math.floor(sample * 6);
  s.movable = legalMoves(s.tokens[s.current], s.value);
  s.awaiting = s.movable.length > 0;
  if (!s.awaiting) {
    s.message = `Player ${s.current + 1} rolled ${s.value} — no legal moves.`;
    if (s.value !== 6) s.current = (s.current + 1) % s.count;
  } else {
    s.message = `Player ${s.current + 1} rolled ${s.value}. Choose a token.`;
    if (s.movable.length === 1) ludoMove(s, s.movable[0]);
  }
  return next;
}
