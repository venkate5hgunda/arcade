import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { useReducedMotion } from '../lib/motion.ts';
import { SAFE_TRACK } from '../lib/races.ts';
import type { LudoState, RaceState, SnakesState } from '../lib/races.ts';
import {
  boardArt,
  createBoardLayout,
  squareCenter,
} from '../lib/snakes-board.ts';
const COLORS = ['red', 'blue', 'green', 'gold'] as const;
const SYMBOLS = ['★', '♦', '●', '▲'];
function buildTrack() {
  const cells: number[][] = [],
    add = (row: number, col: number) => cells.push([row, col]);
  for (let col = 1; col <= 5; col++) add(6, col);
  for (let row = 5; row >= 0; row--) add(row, 6);
  add(0, 7);
  add(0, 8);
  for (let row = 1; row <= 5; row++) add(row, 8);
  for (let col = 9; col <= 14; col++) add(6, col);
  add(7, 14);
  add(8, 14);
  for (let col = 13; col >= 9; col--) add(8, col);
  for (let row = 9; row <= 14; row++) add(row, 8);
  add(14, 7);
  add(14, 6);
  for (let row = 13; row >= 9; row--) add(row, 6);
  for (let col = 5; col >= 0; col--) add(8, col);
  add(7, 0);
  add(6, 0);
  return cells;
}
export const TRACK = buildTrack();
const LANES = [
  Array.from({ length: 6 }, (_, i) => [7, 1 + i]),
  Array.from({ length: 6 }, (_, i) => [1 + i, 7]),
  Array.from({ length: 6 }, (_, i) => [7, 13 - i]),
  Array.from({ length: 6 }, (_, i) => [13 - i, 7]),
];
const YARDS = [
  [1, 1],
  [1, 10],
  [10, 10],
  [10, 1],
];
function tokenCell(player: number, index: number, progress: number) {
  if (progress < 0) {
    const [row, col] = YARDS[player];
    return [row + Math.floor(index / 2) * 2, col + (index % 2) * 2];
  }
  if (progress === 58) return [7, 7];
  if (progress >= 52) return LANES[player][progress - 52];
  return TRACK[(player * 13 + progress) % 52];
}
function frames(previous: RaceState, next: RaceState): RaceState[] {
  if (previous.gameId !== next.gameId || previous.state.winner != null)
    return [];
  if (
    previous.gameId === 'snakes-ladders' &&
    next.gameId === 'snakes-ladders'
  ) {
    const player = previous.state.current,
      from = previous.state.positions[player],
      to = next.state.positions[player],
      roll = next.state.lastRoll,
      land = from + roll;
    if (from === to || land > 100) return [];
    const path = Array.from({ length: roll }, (_, i) => from + i + 1);
    if (to !== land) path.push(to);
    return path.map((position) => {
      const state = structuredClone(next.state);
      state.current = player;
      state.winner = null;
      state.positions[player] = position;
      state.message =
        position === land && to !== land
          ? to > land
            ? 'Climbing the ladder…'
            : 'Sliding down the snake…'
          : `Player ${player + 1} is moving…`;
      return { gameId: 'snakes-ladders', state };
    });
  }
  if (previous.gameId === 'ludo' && next.gameId === 'ludo') {
    const player = previous.state.current,
      index = previous.state.tokens[player].findIndex(
        (n, i) => n !== next.state.tokens[player][i],
      );
    if (index < 0) return [];
    const from = previous.state.tokens[player][index],
      to = next.state.tokens[player][index];
    if (to < 0 || to <= from) return [];
    const path =
      from < 0
        ? [0]
        : Array.from({ length: to - from }, (_, i) => from + i + 1);
    return path.map((position) => {
      const state = structuredClone(next.state);
      state.tokens = structuredClone(previous.state.tokens);
      state.tokens[player][index] = position;
      state.current = player;
      state.winner = null;
      state.awaiting = false;
      state.movable = [];
      state.message = `Player ${player + 1} is moving…`;
      return { gameId: 'ludo', state };
    });
  }
  return [];
}
function useRaceMotion(
  game: RaceState,
  onMotion?: (actor: number | null) => void,
) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(game),
    [moving, setMoving] = useState(false),
    last = useRef(game);
  useEffect(() => {
    const old = last.current;
    last.current = game;
    const steps = reduced ? [] : frames(old, game);
    if (!steps.length) {
      setDisplay(game);
      setMoving(false);
      onMotion?.(null);
      return;
    }
    setMoving(true);
    onMotion?.(old.state.current);
    let step = 0;
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => {
      if (step < steps.length) {
        setDisplay(steps[step++]);
        timer = setTimeout(advance, step === steps.length ? 300 : 120);
      } else {
        setDisplay(game);
        setMoving(false);
        onMotion?.(null);
      }
    };
    advance();
    return () => clearTimeout(timer);
  }, [game, reduced]);
  return { display, moving };
}
function SnakesBoard({
  state,
  names,
}: {
  state: SnakesState;
  names: string[];
}) {
  const [selected, setSelected] = useState(1),
    layout = useMemo(() => createBoardLayout(state.seed), [state.seed]);
  const squares = Array.from({ length: 100 }, (_, i) => {
    const row = Math.floor(i / 10),
      col = i % 10;
    return (9 - row) * 10 + (row % 2 === 0 ? 10 - col : col + 1);
  });
  function inspect(num: number) {
    const snake = layout.snakes.find((item) => item.start === num),
      ladder = layout.ladders.find((item) => item.start === num);
    return `Square ${num}${snake ? `, snake to ${snake.end}` : ladder ? `, ladder to ${ladder.end}` : ''}${state.positions.flatMap((pos, p) => (pos === num ? [`, ${names[p] || `Player ${p + 1}`}`] : [])).join('')}`;
  }
  function key(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -10,
      ArrowDown: 10,
    };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const indexNext = Math.max(0, Math.min(99, index + offsets[event.key]));
    const target =
      event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
        `[data-square="${squares[indexNext]}"]`,
      );
    setSelected(squares[indexNext]);
    target?.focus();
  }
  return (
    <>
      <div
        className="race-scroll"
        role="region"
        aria-label="Snakes and Ladders board"
        tabIndex={0}
      >
        <div className="snakes-board">
          <div
            className="snakes-grid"
            role="group"
            aria-label="100 numbered squares"
          >
            {squares.map((n, index) => (
              <button
                key={n}
                data-square={n}
                tabIndex={selected === n ? 0 : -1}
                className={
                  (Math.floor(index / 10) + (index % 10)) % 2
                    ? 'tile-warm'
                    : 'tile-cream'
                }
                aria-label={inspect(n)}
                onClick={() => setSelected(n)}
                onKeyDown={(event) => key(event, index)}
              >
                {n}
              </button>
            ))}
          </div>
          <div
            className="snakes-art"
            dangerouslySetInnerHTML={{ __html: boardArt(layout) }}
          />
          {state.positions.map(
            (pos, player) =>
              pos > 0 && (
                <span
                  key={player}
                  className={`race-token token-${COLORS[player]}`}
                  role="img"
                  aria-label={`${names[player] || `Player ${player + 1}`} on square ${pos}`}
                  style={{
                    left: `${squareCenter(pos).x / 10}%`,
                    top: `${squareCenter(pos).y / 10}%`,
                    transform: `translate(calc(-50% + ${(player % 2) * 12 - 6}px),calc(-50% + ${Math.floor(player / 2) * 12 - 6}px))`,
                  }}
                >
                  {SYMBOLS[player]}
                </span>
              ),
          )}
        </div>
      </div>
      <p className="race-inspector" role="status">
        {inspect(selected)}
      </p>
    </>
  );
}
function LudoBoard({
  state,
  names,
  blocked,
  onAction,
}: {
  state: LudoState;
  names: string[];
  blocked: boolean;
  onAction: (action: unknown) => void;
}) {
  const cells = Array.from({ length: 225 }, (_, i) => {
    const row = Math.floor(i / 15),
      col = i % 15,
      track = TRACK.findIndex(([r, c]) => r === row && c === col),
      lane = LANES.findIndex((group) =>
        group.some(([r, c]) => r === row && c === col),
      ),
      yard =
        row < 6 && col < 6
          ? 0
          : row < 6 && col > 8
            ? 1
            : row > 8 && col > 8
              ? 2
              : row > 8 && col < 6
                ? 3
                : -1;
    return { row, col, track, lane, yard };
  });
  const all = state.tokens.flatMap((group, player) =>
    group.map((progress, index) => ({
      player,
      index,
      progress,
      cell: tokenCell(player, index, progress),
    })),
  );
  return (
    <div
      className="race-scroll"
      role="region"
      aria-label="Ludo board"
      tabIndex={0}
    >
      <div className="ludo-board" aria-label="Ludo cross-shaped track">
        {cells.map(({ row, col, track, lane, yard }) => (
          <span
            key={`${row}-${col}`}
            aria-hidden="true"
            className={`ludo-cell ${track >= 0 ? 'track' : ''} ${SAFE_TRACK.has(track) ? 'safe' : ''} ${lane >= 0 ? `lane-${COLORS[lane]}` : ''} ${yard >= 0 ? `yard-${COLORS[yard]}` : ''} ${row === 7 && col === 7 ? 'finish' : ''}`}
          >
            {SAFE_TRACK.has(track) ? '✦' : ''}
          </span>
        ))}
        {YARDS.map(([row, col], player) => (
          <div
            key={player}
            className={`ludo-yard-frame yard-frame-${COLORS[player]} ${state.current === player ? 'active' : ''}`}
            style={{
              gridRow: `${row}/${row + 6}`,
              gridColumn: `${col}/${col + 6}`,
            }}
            aria-hidden="true"
          >
            {player < state.count && (names[player] || `Player ${player + 1}`)}
          </div>
        ))}
        {all.map(({ player, index, progress, cell }) => {
          const [row, col] = cell,
            others = all.filter(
              (item) => item.cell[0] === row && item.cell[1] === col,
            ),
            slot = others.findIndex(
              (item) => item.player === player && item.index === index,
            ),
            offset =
              others.length > 1
                ? [(slot % 2) * 12 - 6, (Math.floor(slot / 2) % 2) * 12 - 6]
                : [0, 0];
          const playable =
            !blocked &&
            player === state.current &&
            state.awaiting &&
            state.movable.includes(index);
          return (
            <button
              key={`${player}-${index}`}
              className={`ludo-token token-${COLORS[player]} ${playable ? 'movable' : ''}`}
              style={
                {
                  gridRow: row + 1,
                  gridColumn: col + 1,
                  '--offset-x': `${offset[0]}px`,
                  '--offset-y': `${offset[1]}px`,
                } as CSSProperties
              }
              aria-label={`${names[player] || `Player ${player + 1}`} token ${index + 1}, ${progress < 0 ? 'in home yard' : progress === 58 ? 'finished' : `progress ${progress}`}${playable ? ', move token' : ''}`}
              aria-disabled={!playable}
              onClick={() => {
                if (playable) onAction({ type: 'move', index });
              }}
            >
              <span aria-hidden="true">✦</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
export function RaceTable({
  game,
  names,
  blocked = false,
  onAction,
  onMotion,
}: {
  game: RaceState;
  names: string[];
  blocked?: boolean;
  onAction: (action: unknown) => void;
  onMotion?: (actor: number | null) => void;
}) {
  const { display, moving } = useRaceMotion(game, onMotion),
    state = display.state,
    count =
      display.gameId === 'ludo'
        ? display.state.count
        : display.state.playerCount,
    die =
      display.gameId === 'ludo' ? display.state.value : display.state.lastRoll,
    awaiting = display.gameId === 'ludo' && display.state.awaiting;
  const over = state.winner != null,
    label = (seat: number) => names[seat] || `Player ${seat + 1}`;
  return (
    <div className={`race-table ${display.gameId}`}>
      <div className="race-players" aria-label="Players">
        {Array.from({ length: count }, (_, p) => (
          <div
            key={p}
            className={`race-player ${p === state.current && !over ? 'active' : ''}`}
          >
            <span
              className={`race-avatar token-${COLORS[p]}`}
              aria-hidden="true"
            >
              {SYMBOLS[p]}
            </span>
            <span>
              <b>{label(p)}</b>
              <small>
                {display.gameId === 'snakes-ladders'
                  ? display.state.positions[p]
                    ? `Square ${display.state.positions[p]}`
                    : 'At start'
                  : `${display.state.tokens[p].filter((n) => n === 58).length}/4 home`}
              </small>
            </span>
          </div>
        ))}
      </div>
      <div className="race-controls">
        <button
          className="primary"
          disabled={blocked || moving || over || awaiting}
          onClick={() => onAction({ type: 'roll' })}
        >
          Roll die <span aria-hidden="true">→</span>
        </button>
        <span
          className={`race-die ${moving ? 'rolling' : ''}`}
          role="img"
          aria-label={`Last roll ${die}`}
        >
          {['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][die - 1]}
        </span>
        <p role="status">
          {moving
            ? `${label(state.current)} is moving…`
            : state.message ||
              (over
                ? `${label(state.winner!)} wins!`
                : awaiting
                  ? `${label(state.current)}: choose a glowing token.`
                  : blocked
                    ? 'Waiting for the current player.'
                    : `${label(state.current)}: roll to play.`)}
        </p>
      </div>
      {display.gameId === 'ludo' &&
        awaiting &&
        !blocked &&
        !moving &&
        !over && (
          <div
            className="token-choice-list"
            role="group"
            aria-label="Choose a token"
          >
            {display.state.movable.map((index) => (
              <button
                className="quiet"
                key={index}
                onClick={() => onAction({ type: 'move', index })}
              >
                Move token {index + 1}
              </button>
            ))}
          </div>
        )}
      {display.gameId === 'snakes-ladders' ? (
        <SnakesBoard state={display.state} names={names} />
      ) : (
        <LudoBoard
          state={display.state}
          names={names}
          blocked={blocked || moving || over}
          onAction={onAction}
        />
      )}
    </div>
  );
}
