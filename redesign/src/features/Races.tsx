import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Frame, useRun } from '../components/GameFrame.tsx';
import { RaceTable } from '../components/RaceTable.tsx';
import {
  applyRace,
  newRace,
  validLudo,
  validSnakes,
  wrapRace,
} from '../lib/races.ts';
import type { LudoState, RaceId, SnakesState } from '../lib/races.ts';
import { names as readNames } from '../lib/profile.ts';
import { KEYS, saveJSON } from '../lib/storage.ts';
const HELP = {
  'snakes-ladders':
    'Roll to race toward 100. Land at a ladder foot to climb, or a snake head to slide. You need an exact roll to finish. Each match has a fresh seeded board, including the long snake from 99 to 21. Select a square to inspect it; use arrow keys to move between squares.',
  ludo: 'Roll a six to bring a token out of its yard. Choose a glowing token when more than one can move. Land on an opponent outside a starred safe square to send them home and roll again; a six also gives another roll. Travel the full track and your color’s home lane. An exact roll brings each token home; the first player to bring all four home wins.',
};
export function RacesGame({ id }: { id: RaceId }) {
  const run = useRun<SnakesState | LudoState>(
    id,
    { players: id === 'ludo' ? '4' : '2' },
    id === 'ludo' ? validLudo : validSnakes,
    (settings) =>
      newRace(id, Math.max(2, Math.min(4, Number(settings.players) || 2)))
        .state,
    (state) => state.winner != null,
  );
  const game = useMemo(
    () => (run.state ? wrapRace(id, run.state) : null),
    [id, run.state],
  );
  const [names, setNames] = useState(readNames),
    [moving, setMoving] = useState<number | null>(null);
  // A legacy checkpoint carries its own player count, independent of settings.
  useEffect(() => {
    if (run.state) {
      const count =
        'count' in run.state ? run.state.count : run.state.playerCount;
      run.setSettings((settings) => ({ ...settings, players: String(count) }));
    }
    // Only reconcile the initially restored match, not later setup changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const label = (n: number) => names[n] || `Player ${n + 1}`;
  const actor = game?.state.current ?? 0,
    winner = game?.state.winner,
    awaiting = game?.gameId === 'ludo' && game.state.awaiting;
  function act(action: unknown) {
    if (!game || moving !== null) return;
    const next = applyRace(game, action, actor);
    if (next) run.commit(next.state, next.state.winner != null);
  }
  return (
    <Frame
      run={run}
      fields={[
        {
          key: 'players',
          label: 'Players',
          options: [2, 3, 4].map((n) => [String(n), `${n} players`]),
        },
      ]}
      summary={
        id === 'ludo'
          ? 'Four colors, one exciting race home.'
          : 'Roll, climb, and watch out for the snakes.'
      }
      title={
        moving !== null
          ? `${label(moving)} is moving…`
          : winner != null
            ? `${label(winner)} wins!`
            : `${label(actor)}’s turn`
      }
      status={
        moving !== null
          ? 'Watch your piece travel.'
          : winner != null
            ? 'A wonderful race. Play again?'
            : awaiting
              ? 'Choose a highlighted token.'
              : game?.state.message || 'Roll the die to start your turn.'
      }
      help={HELP[id]}
      setupExtra={
        <>
          <details className="help-card">
            <summary>Player names</summary>
            {Array.from(
              {
                length: Math.max(
                  2,
                  Math.min(4, Number(run.settings.players) || 2),
                ),
              },
              (_, i) => (
                <label key={i}>
                  Player {i + 1} name
                  <input
                    maxLength={24}
                    placeholder={`Player ${i + 1}`}
                    value={names[i] ?? ''}
                    onChange={(e) => {
                      const next = [...names];
                      next[i] = e.target.value;
                      setNames(next);
                      saveJSON(KEYS.PLAYER_NAMES, next);
                    }}
                  />
                </label>
              ),
            )}
          </details>
          <Link className="room-callout" to="/room">
            Different screens? Start a private room →
          </Link>
        </>
      }
      after={
        winner != null &&
        moving === null && (
          <button className="primary" onClick={() => run.start()}>
            Play again
          </button>
        )
      }
    >
      {game && (
        <RaceTable
          game={game}
          names={names}
          onAction={act}
          onMotion={setMoving}
        />
      )}
      <Link className="room-callout" to="/room">
        Different screens? Start a private room →
      </Link>
    </Frame>
  );
}
