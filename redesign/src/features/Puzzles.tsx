import { playCue, playSimonPad } from '../lib/feedback.ts';
import { Frame, useRun } from '../components/GameFrame.tsx';
import type { Field } from '../components/GameFrame.tsx';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { KEYS, loadJSON, saveJSON } from '../lib/storage.ts';
import { names } from '../lib/profile.ts';
import { useReducedMotion } from '../lib/motion.ts';
import {
  c4Drop,
  c4AI,
  c4Win,
  validC4,
  tileMove,
  tileSpawn,
  tileHasMoves,
  validTiles,
  mineInitial,
  mineReveal,
  validMines,
  DIFFICULTIES,
  memoryInitial,
  memoryFlip,
  memoryHide,
  validMemory,
  validSimon,
  simonPress,
} from '../lib/puzzles.ts';
import type {
  PuzzleId,
  TileState,
  MineState,
  MemoryState,
  SimonState,
  Direction,
} from '../lib/puzzles.ts';
import type { LocalState } from '../lib/tictactoe.ts';
import { ConnectBoard } from '../components/ConnectBoard.tsx';

const modeField: Field = {
  key: 'mode',
  label: 'Opponent',
  options: [
    ['pvp', '2 players'],
    ['ai', 'Vs computer'],
  ],
};
function ConnectGame() {
  const run = useRun<LocalState>(
    'connect-four',
    { mode: 'pvp' },
    validC4,
    (s) => ({
      mode: s.mode === 'ai' ? 'ai' : 'pvp',
      board: Array(42).fill(0),
      current: 1,
      over: false,
    }),
  );
  const s = run.state;
  const [playerNames] = useState(names);
  const label = (seat: number) =>
    s?.mode === 'ai' && seat === 2
      ? 'Computer'
      : playerNames[seat - 1] || `Player ${seat}`;
  useEffect(() => {
    if (!s || s.over || s.mode !== 'ai' || s.current !== 2) return;
    const timer = setTimeout(() => run.commit(c4Drop(s, c4AI(s.board))), 450);
    return () => clearTimeout(timer);
  }, [s]);
  const finished = !!s?.over,
    win = s && c4Win(s.board);
  return (
    <Frame
      run={run}
      fields={[modeField]}
      summary="Drop a disc. Build a line. Keep your rival guessing."
      help="Choose a column to drop a disc. Connect four horizontally, vertically or diagonally. Red starts. Full columns cannot accept a disc. Play a friend or the computer; room play is also available from Room."
      title={
        finished
          ? win
            ? `${label(s!.current)} wins!`
            : 'A hard-fought draw.'
          : s?.mode === 'ai' && s.current === 2
            ? 'Computer is thinking…'
            : `${label(s?.current ?? 1)}’s turn`
      }
      status={
        finished
          ? 'Four in a row. Ready for a rematch?'
          : `${s?.current === 2 ? 'Gold' : 'Red'} to move · choose an open column.`
      }
      after={
        finished ? (
          <button className="primary rematch" onClick={run.start}>
            Play again
          </button>
        ) : (
          <Link className="room-callout" to="/room">
            Play on separate screens →
          </Link>
        )
      }
    >
      {s && (
        <ConnectBoard
          state={s}
          blocked={finished || (s.mode === 'ai' && s.current === 2)}
          drop={(column) => run.commit(c4Drop(s, column))}
        />
      )}
    </Frame>
  );
}
function TileGame() {
  const reduced = useReducedMotion();
  const run = useRun<TileState>('2048', {}, validTiles, () => ({
    grid: tileSpawn(
      tileSpawn(Array.from({ length: 4 }, () => Array(4).fill(0))),
    ),
    score: 0,
    won: false,
    keepPlaying: false,
  }));
  const s = run.state;
  const [best, setBest] = useState(() => {
    const n = loadJSON<unknown>(`${KEYS.HIGH_SCORES}:2048`, 0);
    return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : 0;
  });
  const boardRef = useRef<HTMLDivElement>(null);
  const [motion, setMotion] = useState<{
    tiles: ReturnType<typeof tileMove>['tiles'];
    width: number;
  } | null>(null);
  const queued = useRef<Direction | null>(null);
  const [effects, setEffects] = useState<{ merges: number[]; spawned: number }>(
    { merges: [], spawned: -1 },
  );
  useEffect(() => {
    if (!motion) return;
    if (reduced) {
      setMotion(null);
      return;
    }
    const timer = setTimeout(() => setMotion(null), 175);
    return () => clearTimeout(timer);
  }, [motion, reduced]);
  useEffect(() => {
    if (!motion && queued.current) {
      const dir = queued.current;
      queued.current = null;
      move(dir);
    }
  }, [motion]);
  const touch = useRef<{ x: number; y: number } | null>(null);
  function move(direction: Direction) {
    if (!s || s.over || (s.won && !s.keepPlaying)) return;
    if (motion) {
      queued.current = direction;
      return;
    }
    const result = tileMove(s.grid, direction);
    if (JSON.stringify(result.grid) === JSON.stringify(s.grid)) return;
    const grid = tileSpawn(result.grid),
      score = s.score + result.gained,
      won = grid.some((row) => row.some((v) => v >= 2048));
    const next = { ...s, grid, score, won, over: !tileHasMoves(grid) };
    if (score > best) {
      setBest(score);
      saveJSON(`${KEYS.HIGH_SCORES}:2048`, score);
    }
    setEffects({
      merges: result.merges.map(({ r, c }) => r * 4 + c),
      spawned: grid
        .flat()
        .findIndex(
          (value, index) => value !== 0 && result.grid.flat()[index] === 0,
        ),
    });
    if (!reduced && boardRef.current)
      setMotion({
        tiles: result.tiles,
        width: boardRef.current.getBoundingClientRect().width,
      });
    run.commit(next, !!next.over || (won && !s.keepPlaying));
  }
  useEffect(() => {
    if (!s) return;
    const handler = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).closest('input,select,textarea') ||
        document.querySelector('[role="alertdialog"]')
      )
        return;
      const dir = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'up',
        ArrowDown: 'down',
      }[event.key] as Direction | undefined;
      if (dir) {
        event.preventDefault();
        move(dir);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [s, motion, reduced]);
  return (
    <Frame
      run={run}
      fields={[]}
      summary="A few small moves can add up to something big."
      help="Use arrow keys, swipe the board, or use the direction buttons. Equal tiles merge once per move. Reach 2048, then keep going if you like. A move that changes nothing does not spawn a tile."
      title={
        s?.over
          ? s.won && !s.keepPlaying
            ? 'You reached 2048! No moves left.'
            : 'No moves left.'
          : s?.won && !s.keepPlaying
            ? 'You reached 2048!'
            : 'Slide. Merge. Repeat.'
      }
      status={`Score ${s?.score ?? 0} · Best ${best}`}
      after={
        s?.over ? (
          <button className="primary rematch" onClick={run.start}>
            Try again
          </button>
        ) : s?.won && !s.keepPlaying ? (
          <div className="actions">
            <button
              className="primary"
              onClick={() => run.commit({ ...s, keepPlaying: true })}
            >
              Keep going
            </button>
            <button className="quiet" onClick={run.start}>
              New game
            </button>
          </div>
        ) : (
          <div className="direction-controls">
            {(['left', 'up', 'down', 'right'] as Direction[]).map((dir) => (
              <button
                className="quiet"
                key={dir}
                onClick={() => move(dir)}
                aria-label={`Move ${dir}`}
              >
                {{ left: '←', up: '↑', down: '↓', right: '→' }[dir]}
              </button>
            ))}
          </div>
        )
      }
    >
      {s && (
        <div
          ref={boardRef}
          className={`tile-grid ${motion ? 'tile-moving' : ''}`}
          role="group"
          aria-label="2048 board"
          tabIndex={0}
          onTouchStart={(e) => {
            touch.current = {
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
            };
          }}
          onTouchEnd={(e) => {
            if (!touch.current) return;
            const dx = e.changedTouches[0].clientX - touch.current.x,
              dy = e.changedTouches[0].clientY - touch.current.y;
            touch.current = null;
            if (Math.max(Math.abs(dx), Math.abs(dy)) >= 24)
              move(
                Math.abs(dx) > Math.abs(dy)
                  ? dx > 0
                    ? 'right'
                    : 'left'
                  : dy > 0
                    ? 'down'
                    : 'up',
              );
          }}
        >
          {s.grid.flat().map((value, index) => (
            <div
              className={`number-tile tile-${value} ${!motion && effects.merges.includes(index) ? 'tile-merged' : ''} ${!motion && effects.spawned === index ? 'tile-spawned' : ''}`}
              role="img"
              key={index}
              aria-label={`Row ${Math.floor(index / 4) + 1}, column ${(index % 4) + 1}: ${value || 'empty'}`}
            >
              {value || ''}
            </div>
          ))}
          {motion && (
            <div className="tile-motion-layer" aria-hidden="true">
              {motion.tiles.map((tile, index) => {
                const step = (motion.width + 10) / 4;
                const size = step - 10;
                return (
                  <span
                    key={index}
                    className={`number-tile movement-tile tile-${tile.value}`}
                    style={
                      {
                        left: tile.c * step,
                        top: tile.r * step,
                        width: size,
                        height: size,
                        '--travel-x': `${(tile.tc - tile.c) * step}px`,
                        '--travel-y': `${(tile.tr - tile.r) * step}px`,
                      } as CSSProperties
                    }
                  >
                    {tile.value}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Frame>
  );
}
function MinesGame() {
  const run = useRun<MineState>(
    'minesweeper',
    { difficulty: 'easy' },
    validMines,
    (s) =>
      mineInitial(
        Object.hasOwn(DIFFICULTIES, s.difficulty)
          ? (s.difficulty as MineState['difficulty'])
          : 'easy',
      ),
  );
  const s = run.state,
    config = DIFFICULTIES[s?.difficulty ?? 'easy'];
  function reveal(index: number, flag = false) {
    if (s) run.commit(mineReveal(s, index, flag));
  }
  return (
    <Frame
      run={run}
      fields={[
        {
          key: 'difficulty',
          label: 'Difficulty',
          options: [
            ['easy', 'Easy · 9×9 · 10 mines'],
            ['medium', 'Medium · 16×16 · 40 mines'],
            ['hard', 'Hard · 16×30 · 99 mines'],
          ],
        },
      ]}
      summary="A calm head, a careful step. Clear the field."
      help="Reveal every safe square. Your first reveal and its neighbors are always safe. Numbers count adjacent mines. Toggle Flag mode on touch, right-click, or press F over a square to mark a mine. Large fields scroll horizontally with touch or keyboard focus."
      title={
        s?.over
          ? s.won
            ? 'You cleared the field!'
            : 'A mine! Try a fresh field.'
          : 'One safe step at a time.'
      }
      status={`${config.mines - (s?.board.filter((c) => c.flagged).length ?? 0)} mines left · ${config.rows} × ${config.cols}`}
      after={
        s?.over && (
          <button className="primary rematch" onClick={run.start}>
            Play again
          </button>
        )
      }
    >
      {s && (
        <>
          <button
            className="quiet flag-toggle"
            aria-pressed={s.flagMode}
            onClick={() => run.commit({ ...s, flagMode: !s.flagMode })}
          >
            Flag mode: {s.flagMode ? 'on' : 'off'}
          </button>
          <div
            className="mine-scroll"
            tabIndex={0}
            aria-label="Minefield scroll area"
          >
            <div
              className="mine-grid"
              style={{ gridTemplateColumns: `repeat(${config.cols}, 36px)` }}
              role="group"
              aria-label="Minefield"
            >
              {s.board.map((cell, index) => (
                <button
                  className={`mine-cell ${cell.revealed ? 'revealed' : ''} ${cell.mine && cell.revealed ? 'exploded' : ''}`}
                  key={index}
                  aria-label={`${cell.revealed ? 'Revealed' : cell.flagged ? 'Flagged' : 'Reveal or flag'} row ${Math.floor(index / config.cols) + 1}, column ${(index % config.cols) + 1}${cell.revealed ? (cell.mine ? ', mine' : `, ${cell.count || 'empty'}`) : ''}`}
                  disabled={!!s.over}
                  onClick={() => reveal(index, s.flagMode)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    reveal(index, true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key.toLowerCase() === 'f') {
                      e.preventDefault();
                      reveal(index, true);
                    }
                  }}
                >
                  {cell.revealed
                    ? cell.mine
                      ? '✹'
                      : cell.count || ''
                    : cell.flagged
                      ? '⚑'
                      : ''}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </Frame>
  );
}
function MemoryGame() {
  const run = useRun<MemoryState>(
    'memory',
    { size: '4', players: '1' },
    validMemory,
    (s) =>
      memoryInitial(
        ['4', '6', '8'].includes(s.size)
          ? (s.size as MemoryState['size'])
          : '4',
        s.players === '2' ? '2' : '1',
      ),
  );
  const [pending, setPending] = useState<number[] | null>(null);
  const [playerNames] = useState(names);
  const s = run.state;
  useEffect(() => {
    if (!s) {
      setPending(null);
      return;
    }
    if (!pending) return;
    const timer = setTimeout(() => {
      run.commit(memoryHide(s, pending));
      setPending(null);
    }, 700);
    return () => clearTimeout(timer);
  }, [pending, s]);
  function flip(index: number) {
    if (!s || pending) return;
    const result = memoryFlip(s, index);
    if (result.mismatch) {
      playCue({ sound: 'buzz', haptic: 'failure' });
      run.commit(memoryHide(result.state, result.mismatch));
      run.view(result.state);
      setPending(result.mismatch);
    } else run.commit(result.state);
  }
  const winner = s
    ? s.scores[1] > s.scores[2]
      ? 1
      : s.scores[2] > s.scores[1]
        ? 2
        : 0
    : 0;
  const label = (seat: number) => playerNames[seat - 1] || `Player ${seat}`;
  return (
    <Frame
      run={run}
      fields={[
        {
          key: 'size',
          label: 'Grid size',
          options: [
            ['4', '4 × 4 · Easy'],
            ['6', '6 × 6 · Medium'],
            ['8', '8 × 8 · Hard'],
          ],
        },
        {
          key: 'players',
          label: 'Players',
          options: [
            ['1', 'Solo'],
            ['2', '2 players'],
          ],
        },
      ]}
      summary="Turn a card. Find a friend. Remember the little things."
      help="Flip two cards to find a matching pair. Matched pairs stay face up and earn a point. A match keeps your turn; a mismatch passes the turn in two-player mode. Use Tab and Enter to inspect and flip cards. Large decks scroll on small screens."
      title={
        s?.over
          ? s.players === '1'
            ? 'Every pair found!'
            : winner
              ? `${label(winner)} wins!`
              : 'A perfect tie!'
          : pending
            ? 'Remember those two…'
            : s?.players === '2'
              ? `${label(s.current)}’s turn`
              : 'Find the matching pairs.'
      }
      status={`Pairs ${s ? s.scores[1] + s.scores[2] : 0} / ${s ? s.cards.length / 2 : 8}${s?.players === '2' ? ` · ${label(1)} ${s.scores[1]} — ${label(2)} ${s.scores[2]}` : ''}`}
      after={
        s?.over && (
          <button className="primary rematch" onClick={run.start}>
            Play again
          </button>
        )
      }
    >
      {s && (
        <div className="memory-scroll">
          <div
            className="memory-grid"
            style={{
              gridTemplateColumns: `repeat(${s.size}, minmax(44px, 1fr))`,
            }}
            role="group"
            aria-label="Memory cards"
          >
            {s.cards.map((card) => (
              <button
                key={card.index}
                className={`memory-card ${card.revealed ? 'face-up' : ''} ${card.matched ? 'matched' : ''}`}
                aria-label={`${card.matched ? 'Matched' : card.revealed ? 'Revealed' : 'Flip'} card ${card.index + 1}${card.revealed ? `: ${card.symbol}` : ''}`}
                aria-disabled={!!pending || card.revealed || !!s.over}
                onClick={() => {
                  if (!pending && !card.revealed && !s.over) flip(card.index);
                }}
              >
                {card.revealed ? (
                  card.symbol
                ) : (
                  <span aria-hidden="true">?</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </Frame>
  );
}
const PAD_NAMES = ['Red', 'Blue', 'Yellow', 'Green'];
function SimonGame() {
  const run = useRun<SimonState>(
    'simon',
    { speed: 'normal' },
    validSimon,
    (s) => ({
      speed: ['slow', 'normal', 'fast'].includes(s.speed)
        ? (s.speed as SimonState['speed'])
        : 'normal',
      sequence: [Math.floor(Math.random() * 4)],
      playerStep: 0,
    }),
  );
  const s = run.state;
  const [phase, setPhase] = useState<'watch' | 'input' | 'next'>('watch');
  const [active, setActive] = useState<number | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [best, setBest] = useState(() => {
    const n = loadJSON<unknown>(`${KEYS.HIGH_SCORES}:simon`, 0);
    return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : 0;
  });
  const sequenceKey = s?.sequence.join(',');
  useEffect(() => {
    if (!s || s.over || s.playerStep === s.sequence.length) return;
    setPhase('watch');
    setActive(null);
    const step = { slow: 700, normal: 500, fast: 340 }[s.speed];
    const timers: ReturnType<typeof setTimeout>[] = [];
    s.sequence.forEach((pad, index) => {
      const start = 500 + index * step * 0.95;
      timers.push(
        setTimeout(() => {
          setActive(pad);
          playSimonPad(pad, (step * 0.6) / 1000);
        }, start),
        setTimeout(() => setActive(null), start + step * 0.6),
      );
    });
    timers.push(
      setTimeout(
        () => {
          setPhase('input');
          run.commit({ ...s, playerStep: 0 });
        },
        500 + s.sequence.length * step * 0.95,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [sequenceKey, epoch]);
  useEffect(() => {
    if (!s || s.over || s.playerStep !== s.sequence.length) return;
    setPhase('next');
    if (s.sequence.length > best) {
      setBest(s.sequence.length);
      saveJSON(`${KEYS.HIGH_SCORES}:simon`, s.sequence.length);
    }
    const timer = setTimeout(
      () =>
        run.commit({
          ...s,
          sequence: [...s.sequence, Math.floor(Math.random() * 4)],
          playerStep: 0,
        }),
      900,
    );
    return () => clearTimeout(timer);
  }, [s]);
  return (
    <Frame
      run={run}
      fields={[
        {
          key: 'speed',
          label: 'Playback speed',
          options: [
            ['slow', 'Slow'],
            ['normal', 'Normal'],
            ['fast', 'Fast'],
          ],
        },
      ]}
      summary="Watch the colors dance. Then make them dance again."
      help="Watch the numbered color pads, then repeat the sequence. One new pad joins each round. A wrong pad ends the game. Color names and numbers accompany the flashes; use Tab and Enter to play. A restored partial round replays its full sequence before input."
      title={
        s?.over
          ? `Game over — reached round ${s.sequence.length}`
          : phase === 'watch'
            ? 'Watch the sequence.'
            : phase === 'next'
              ? 'Nice! Next round…'
              : 'Your turn — repeat it.'
      }
      status={`Round ${s?.sequence.length ?? 1} · Best ${best}${phase === 'watch' && active !== null ? ` · ${PAD_NAMES[active]} ${active + 1}` : ''}`}
      after={
        s?.over && (
          <button
            className="primary rematch"
            onClick={() => {
              setEpoch((v) => v + 1);
              run.start();
            }}
          >
            Play again
          </button>
        )
      }
    >
      <div className="simon-pads">
        {PAD_NAMES.map((name, pad) => (
          <button
            key={name}
            className={`simon-pad pad-${pad} ${active === pad ? 'active' : ''}`}
            aria-label={`Play ${name} pad`}
            aria-disabled={phase !== 'input' || !!s?.over}
            onClick={() => {
              if (s && phase === 'input' && !s.over) {
                playSimonPad(pad);
                run.commit(simonPress(s, pad));
              }
            }}
          >
            <b>{pad + 1}</b>
            <span>{name}</span>
            {active === pad && <small>Watch</small>}
          </button>
        ))}
      </div>
    </Frame>
  );
}
export function PuzzleGame({ id }: { id: PuzzleId }) {
  return id === 'connect-four' ? (
    <ConnectGame />
  ) : id === 'minesweeper' ? (
    <MinesGame />
  ) : id === 'memory' ? (
    <MemoryGame />
  ) : id === '2048' ? (
    <TileGame />
  ) : (
    <SimonGame />
  );
}
