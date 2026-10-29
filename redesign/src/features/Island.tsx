import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Frame, useRun } from '../components/GameFrame.tsx';
import { IslandTable } from '../components/IslandTable.tsx';
import { IslandOptions } from '../components/IslandOptions.tsx';
import {
  DEFAULT_BOARD_OPTIONS,
  actCatan,
  actTradeReply,
  catanView,
  newCatan,
  validCatanCheckpoint,
} from '../lib/catan-core.js';
import type {
  BoardOptions,
  IslandAction,
  IslandState,
} from '../lib/catan-core.js';
import { names as readNames } from '../lib/profile.ts';

export function IslandGame() {
  const [options, setOptions] = useState<BoardOptions>({
    ...DEFAULT_BOARD_OPTIONS,
  });
  const [ports, setPorts] = useState<'fixed' | 'shuffled'>('fixed');
  const [viewer, setViewer] = useState(0),
    [covered, setCovered] = useState(true),
    [error, setError] = useState('');
  const [names] = useState(readNames);
  const run = useRun<IslandState>(
    'catan',
    { count: '3' },
    (s) => validCatanCheckpoint(s),
    (settings) =>
      newCatan(settings.count === '4' ? 4 : 3, Math.random, ports, options),
    (s) => s.winner !== null,
    (value) => {
      const s = structuredClone(value as IslandState);
      if (!s.setupOrder && s.phase !== 'setup-roll') {
        s.setupRolls = Array(s.players.length).fill(null);
        s.setupOrder = s.players.map((_, i) => i);
      }
      return s;
    },
  );
  const state = run.state;
  const nextSeat = (s: IslandState) =>
    s.phase === 'discard'
      ? s.discards.findIndex(Boolean)
      : (s.offer?.to ?? s.current);
  useEffect(() => {
    if (state) {
      setViewer(nextSeat(state));
      setOptions(state.boardOptions ?? DEFAULT_BOARD_OPTIONS);
      setPorts(state.portMode ?? 'shuffled');
      run.setSettings({ count: String(state.players.length) });
    }
  }, []);
  function start() {
    setViewer(0);
    setCovered(true);
    setError('');
    run.start();
  }
  async function dispatch(move: IslandAction) {
    if (!state) return;
    const next = structuredClone(state),
      before = nextSeat(state);
    const dice = () =>
      1 +
      Math.floor(
        (crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000) * 6,
      );
    const actual = ['roll', 'setup-roll'].includes(move.type)
      ? { ...move, dice: [dice(), dice()] }
      : move;
    const ok = ['accept', 'decline'].includes(move.type)
      ? actTradeReply(next, actual, viewer)
      : actCatan(next, actual, viewer);
    if (!ok) {
      setError(
        'That action is unavailable. Check the selected location, cargo, or game phase.',
      );
      return;
    }
    setError('');
    const after = nextSeat(next);
    await run.commit(next, next.winner !== null);
    if (
      next.winner === null &&
      (after !== viewer ||
        ([
          'setup-roll',
          'setup-road',
          'end',
          'offer',
          'discard',
          'accept',
          'decline',
        ].includes(move.type) &&
          after !== before))
    ) {
      setViewer(after);
      setCovered(true);
    }
  }
  return (
    <Frame
      run={{ ...run, start }}
      fields={[
        {
          key: 'count',
          label: 'Navigators',
          options: [
            ['3', '3 players'],
            ['4', '4 players'],
          ],
        },
      ]}
      summary="Build outposts, trade cargo and chart the island together."
      title={
        state?.winner !== null && state
          ? 'Island founded!'
          : covered
            ? `Pass to ${names[viewer] || `Player ${viewer + 1}`}`
            : 'Your island chart'
      }
      status="Place outposts and roads, trade resources, and reach ten points."
      help="Roll for the opening order, then take turns placing two outposts and roads in reverse order. Roll to gather cargo; build, trade, use discoveries and move the raider. The first player to reach ten points wins."
      optionsExtra={
        <IslandOptions
          options={options}
          setOptions={setOptions}
          ports={ports}
          setPorts={setPorts}
        />
      }
      setupExtra={
        <Link className="room-callout" to="/room?game=catan">
          Different screens? Open a private room →
        </Link>
      }
      after={
        state?.winner !== null &&
        state && (
          <button className="primary" onClick={start}>
            Play again
          </button>
        )
      }
    >
      {state &&
        (covered && state.winner === null ? (
          <div className="business-cover">
            <p>Pass the device to {names[viewer] || `Player ${viewer + 1}`}.</p>
            <button className="primary" onClick={() => setCovered(false)}>
              I’m ready · reveal my cargo
            </button>
          </div>
        ) : (
          <IslandTable
            view={catanView(state, viewer)}
            seat={viewer}
            names={state.players.map((_, i) => names[i] || `Player ${i + 1}`)}
            blocked={false}
            action={dispatch}
            error={error}
          />
        ))}
    </Frame>
  );
}
