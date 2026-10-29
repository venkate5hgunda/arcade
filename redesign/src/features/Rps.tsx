import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Frame, useRun } from '../components/GameFrame.tsx';
import { RpsTable } from '../components/RpsTable.tsx';
import {
  newRps,
  validRps,
  rpsDone,
  rpsWinner,
  pickRps,
  revealRps,
  nextRps,
} from '../lib/rps.ts';
import type { RpsState } from '../lib/rps.ts';
import { names as readNames } from '../lib/profile.ts';
export function RpsGame() {
  const run = useRun<RpsState>(
    'rps',
    { mode: 'ai', target: '3' },
    validRps,
    (s) =>
      newRps(
        s.mode === 'pvp' ? 'pvp' : 'ai',
        [3, 5, 7].includes(Number(s.target)) ? Number(s.target) : 3,
      ),
    rpsDone,
  );
  const s = run.state;
  const [names] = useState(readNames),
    [now, setNow] = useState(Date.now);
  const labels = [
    names[0] || 'Player 1',
    s?.mode === 'ai' ? 'Computer' : names[1] || 'Player 2',
  ];
  useEffect(() => {
    if (s) run.setSettings({ mode: s.mode, target: String(s.target) });
  }, []);
  useEffect(() => {
    if (s?.phase !== 'countdown') return;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (time >= s.deadline) run.commit(revealRps(s, time));
    };
    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [s]);
  const done = !!s && rpsDone(s),
    reveal = s?.phase === 'reveal';
  const winner = reveal ? rpsWinner(s.p1Pick!, s.p2Pick!) : null;
  return (
    <Frame
      run={run}
      fields={[
        {
          key: 'mode',
          label: 'Opponent',
          options: [
            ['ai', 'Computer'],
            ['pvp', 'Friend (pass & play)'],
          ],
        },
        {
          key: 'target',
          label: 'First to',
          options: [3, 5, 7].map((n) => [String(n), `${n} wins`]),
        },
      ]}
      summary="Three throws. One friendly rivalry."
      title={
        done
          ? `${labels[s!.score[0] > s!.score[1] ? 0 : 1]} wins the match!`
          : reveal
            ? winner === null
              ? "It's a draw!"
              : `${labels[winner]} wins the round!`
            : s?.phase === 'handoff'
              ? 'Pass the device'
              : s?.phase === 'countdown'
                ? 'Ready… set… throw!'
                : `${labels[s?.phase === 'p2pick' ? 1 : 0]}’s throw`
      }
      status={
        s?.phase === 'handoff'
          ? `${labels[1]}, get ready. The first throw is hidden.`
          : reveal
            ? `Round ${s!.round} · First to ${s!.target}`
            : s?.phase === 'countdown'
              ? 'Both throws are locked in.'
              : 'Choose rock, paper or scissors. Keep your throw secret.'
      }
      help="Rock beats scissors, scissors beats paper, paper beats rock. A draw adds no points. Choose first to 3, 5 or 7 wins. With a friend, pass the device before their secret throw. In a room both players choose independently; first to 3 wins."
      setupExtra={
        <Link className="room-callout" to="/room">
          Different screens? Start a private room →
        </Link>
      }
      after={
        s && (
          <>
            <div className="score-line">
              {s.score.map((n, i) => (
                <span key={i}>
                  {labels[i]}{' '}
                  <strong>
                    {n} / {s.target}
                  </strong>
                </span>
              ))}
            </div>
            {s.phase === 'handoff' && (
              <button
                className="primary"
                onClick={() => run.commit({ ...s, phase: 'p2pick' })}
              >
                I'm ready
              </button>
            )}
            {reveal && (
              <button
                className="primary"
                onClick={() => (done ? run.start() : run.commit(nextRps(s)))}
              >
                {done ? 'Play again' : 'Next round'}
              </button>
            )}
          </>
        )
      }
    >
      {s && (
        <RpsTable
          names={labels}
          picks={reveal ? [s.p1Pick!, s.p2Pick!] : null}
          choosing={s.phase === 'p1pick' || s.phase === 'p2pick'}
          countdown={
            s.phase === 'countdown'
              ? Math.max(0, Math.ceil((s.deadline - now) / 560) - 1)
              : null
          }
          pick={(value) => run.commit(pickRps(s, value))}
        />
      )}
    </Frame>
  );
}
