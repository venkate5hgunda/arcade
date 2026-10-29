import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Frame, useRun } from '../components/GameFrame.tsx';
import { BusinessTable } from '../components/BusinessTable.tsx';
import { BusinessOptionsForm } from '../components/BusinessOptions.tsx';
import {
  DEFAULT_OPTIONS,
  createBusiness,
  validBusiness,
  publicBusiness,
  actBusiness,
} from '../lib/business-core.js';
import type {
  BusinessOptions,
  BusinessState,
  BusinessAction,
} from '../lib/business-core.js';
import { businessResponder, validBusinessMove } from '../lib/business.ts';
import { names as readNames } from '../lib/profile.ts';
import { KEYS, loadJSON, saveJSON } from '../lib/storage.ts';
export function BusinessGame() {
  const raw = loadJSON<unknown>(`${KEYS.SETTINGS}:business`, {}),
    saved =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {},
    [options, setOptions] = useState<BusinessOptions>(
      Object.fromEntries(
        Object.entries(DEFAULT_OPTIONS).map(([key, value]) => [
          key,
          typeof value === 'boolean'
            ? typeof saved[key] === 'boolean'
              ? saved[key]
              : value
            : Number.isSafeInteger(saved[key]) &&
                (saved[key] as number) >= (key === 'turnLimit' ? 0 : 1) &&
                (saved[key] as number) <= (key === 'turnLimit' ? 1000 : 20000)
              ? saved[key]
              : value,
        ]),
      ) as unknown as BusinessOptions,
    ),
    [names] = useState(readNames),
    [viewer, setViewer] = useState(0),
    [covered, setCovered] = useState(true),
    [error, setError] = useState('');
  const run = useRun<BusinessState>(
    'business',
    { count: '2' },
    (s) => validBusiness(s),
    (s) =>
      createBusiness(
        ['2', '3', '4', '5', '6'].includes(s.count) ? Number(s.count) : 2,
        options,
      ),
    (s) => s.phase === 'win',
  );
  const s = run.state,
    publicView = s ? publicBusiness(s) : null;
  useEffect(() => {
    if (s) {
      setViewer(businessResponder(s));
      setOptions(s.options);
      run.setSettings({ count: String(s.players.length) });
    }
  }, []);
  function start() {
    setError('');
    setViewer(0);
    setCovered(true);
    run.start();
    saveJSON(`${KEYS.SETTINGS}:business`, { ...run.settings, ...options });
  }
  function switchSeat(seat: number) {
    setError('');
    setViewer(seat);
    setCovered(true);
  }
  async function action(move: BusinessAction) {
    if (!s || !validBusinessMove(move)) return;
    try {
      const before = businessResponder(s),
        next = actBusiness(s, move, viewer),
        after = businessResponder(next);
      setError('');
      await run.commit(next, next.phase === 'win');
      if (
        next.phase !== 'win' &&
        after !== viewer &&
        (after !== before ||
          s.current !== next.current ||
          (!!next.offer && !s.offer))
      ) {
        setViewer(after);
        setCovered(true);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'That action is not available.',
      );
    }
  }
  return (
    <Frame
      run={{ ...run, start }}
      fields={[
        {
          key: 'count',
          label: 'Players',
          options: [2, 3, 4, 5, 6].map((n) => [String(n), `${n} players`]),
        },
      ]}
      summary="Trade Indian cities, collect rent and build your fortune."
      title={
        s?.phase === 'win'
          ? 'Final standings'
          : covered
            ? `Pass to ${names[viewer] || `Player ${viewer + 1}`}`
            : 'The city is yours'
      }
      status={
        covered && s?.phase !== 'win'
          ? 'Hand over the device before revealing the next player’s actions.'
          : 'Make a move, inspect the board or manage your properties.'
      }
      help="Roll to travel the Indian-city board. Buy unowned deeds or send them to auction. Collect rent, trade, mortgage and develop complete groups evenly. Jail, cards, debt and bankruptcy follow the selected house rules. The last solvent player wins, or the highest net worth wins at the turn limit."
      optionsExtra={
        <BusinessOptionsForm options={options} onChange={setOptions} />
      }
      setupExtra={
        <Link className="room-callout" to="/room?game=business">
          Different screens? Start a private room →
        </Link>
      }
      after={
        s?.phase === 'win' && (
          <button className="primary" onClick={start}>
            Play again
          </button>
        )
      }
    >
      {publicView &&
        (covered && s?.phase !== 'win' ? (
          <div className="business-cover">
            <p>Pass the device to {names[viewer] || `Player ${viewer + 1}`}.</p>
            <button className="primary" onClick={() => setCovered(false)}>
              I’m ready · reveal my actions
            </button>
          </div>
        ) : (
          <BusinessTable
            view={publicView}
            seat={viewer}
            names={s!.players.map((_, i) => names[i] || `Player ${i + 1}`)}
            blocked={false}
            onAction={action}
            error={error}
            localSwitch={switchSeat}
          />
        ))}
    </Frame>
  );
}
