import { useEffect, useState } from 'react';
import { RpsTable } from './RpsTable.tsx';
import { rpsRoomDone, rpsWinner } from '../lib/rps.ts';
import type { RpsView } from '../lib/rps.ts';
export function RpsRoomTable({
  view,
  names,
  connected,
  host,
  action,
  replay,
}: {
  view: RpsView;
  names: string[];
  connected: boolean;
  host: boolean;
  action: (action: unknown) => void;
  replay: () => void;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (view.phase !== 'countdown') return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [view.phase, view.deadline]);
  const done = rpsRoomDone(view),
    winner = view.revealed ? rpsWinner(...view.revealed) : null;
  return (
    <div className="board-panel room-rps-match">
      <p className="room-game-name">Rock Paper Scissors</p>
      <div className="turn-banner" role="status">
        <div>
          <h2>
            {!connected
              ? 'Match paused'
              : done
                ? `${names[view.score[0] === 3 ? 0 : 1]} wins the match!`
                : view.phase === 'reveal'
                  ? winner === null
                    ? "It's a draw!"
                    : `${names[winner]} wins the round!`
                  : view.phase === 'countdown'
                    ? 'Ready… set… throw!'
                    : view.ownPick
                      ? 'Throw locked in!'
                      : 'Choose your secret throw'}
          </h2>
          <p>
            {!connected
              ? 'Reconnect both players to continue.'
              : view.phase === 'picking'
                ? view.ownPick
                  ? 'Waiting for your opponent to choose.'
                  : 'Both players can choose independently.'
                : `Round ${view.turns + (view.phase === 'countdown' ? 1 : 0)} · First to 3 wins`}
          </p>
        </div>
      </div>
      <RpsTable
        names={names}
        picks={view.revealed}
        choosing={view.phase === 'picking' && !view.ownPick}
        countdown={
          view.phase === 'countdown'
            ? Math.max(0, Math.ceil((view.deadline - now) / 560) - 1)
            : null
        }
        blocked={!connected}
        pick={(choice) => action({ type: 'pick', choice })}
      />
      <div className="score-line">
        {view.score.map((score, i) => (
          <span key={i}>
            {names[i]} <strong>{score} / 3</strong>
          </span>
        ))}
      </div>
      {view.phase === 'reveal' &&
        (host ? (
          <button
            className="primary"
            disabled={!connected}
            onClick={() => (done ? replay() : action({ type: 'next' }))}
          >
            {done ? 'Play again' : 'Next round'}
          </button>
        ) : (
          <p>
            Waiting for the host to{' '}
            {done ? 'start a new match' : 'start the next round'}.
          </p>
        ))}
    </div>
  );
}
