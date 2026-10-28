import { useEffect, useRef, useState } from 'react';
import { Frame, useRun } from '../components/GameFrame.tsx';
import { validWhack, newWhack } from '../lib/whack.ts';
import type { WhackState } from '../lib/whack.ts';
import { KEYS, loadJSON, saveJSON } from '../lib/storage.ts';
export function WhackGame() {
  const run = useRun<WhackState>(
    'whack-a-mole',
    { duration: '30' },
    validWhack,
    (s) =>
      newWhack(['30', '45', '60'].includes(s.duration) ? s.duration : '30'),
  );
  const [now, setNow] = useState(Date.now()),
    [active, setActive] = useState(-1),
    [over, setOver] = useState(false),
    [best, setBest] = useState(() => {
      const n = loadJSON<unknown>(`${KEYS.HIGH_SCORES}:whack-a-mole`, 0);
      return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : 0;
    });
  const latest = useRef(run.state);
  latest.current = run.state;
  const game = run.state;
  useEffect(() => {
    if (game) run.setSettings((s) => ({ ...s, duration: game.duration }));
  }, []);
  useEffect(() => {
    if (!game) {
      setOver(false);
      setActive(-1);
    }
  }, [game]);
  useEffect(() => {
    if (!game || over) return;
    let pop: ReturnType<typeof setTimeout>, hide: ReturnType<typeof setTimeout>;
    function show() {
      if (!latest.current || Date.now() >= latest.current.deadline) return;
      setActive(Math.floor(Math.random() * 9));
      const duration = 550 + Math.random() * 450;
      hide = setTimeout(() => setActive(-1), duration);
      pop = setTimeout(show, duration + 150 + Math.random() * 250);
    }
    setNow(Date.now());
    show();
    const clock = setInterval(() => {
      const time = Date.now();
      setNow(time);
      const current = latest.current;
      if (current && time >= current.deadline) {
        run.commit(current, true);
        setActive(-1);
        setOver(true);
      }
    }, 100);
    return () => {
      clearTimeout(pop);
      clearTimeout(hide);
      clearInterval(clock);
    };
  }, [game?.deadline, over]);
  function whack(index: number) {
    if (!game || over) return;
    if (Date.now() >= game.deadline) {
      run.commit(game, true);
      setActive(-1);
      setOver(true);
      return;
    }
    const hit = index === active,
      next = {
        ...game,
        score: game.score + (hit ? 1 : 0),
        misses: game.misses + (hit ? 0 : 1),
      };
    if (hit) {
      setActive(-1);
      if (next.score > best) {
        setBest(next.score);
        saveJSON(`${KEYS.HIGH_SCORES}:whack-a-mole`, next.score);
      }
    }
    run.commit(next);
  }
  function again() {
    setNow(Date.now());
    setOver(false);
    run.start();
  }
  const remaining = game
    ? Math.max(0, Math.ceil((game.deadline - now) / 1000))
    : 0;
  return (
    <Frame
      run={run}
      fields={[
        {
          key: 'duration',
          label: 'Round length',
          options: [30, 45, 60].map((n) => [String(n), `${n} seconds`]),
        },
      ]}
      summary="A quick, cheerful garden challenge."
      title={over ? 'Time’s up!' : 'Catch the peeking moles!'}
      status={
        over
          ? `Score ${game?.score ?? 0} · ${game?.misses ?? 0} misses`
          : 'Tap or select a mole when it pops up.'
      }
      help="Catch the mole before it disappears. Empty holes count as misses. Choose a 30, 45 or 60 second round; your score and the absolute deadline survive reload."
      after={
        over && (
          <button className="primary" onClick={again}>
            Play again
          </button>
        )
      }
    >
      {game && (
        <div className="whack-table">
          <div className="whack-status">
            <span>
              Score <b>{game.score}</b>
            </span>
            <span>
              Time <b>{remaining}s</b>
            </span>
            <span>
              Best <b>{best}</b>
            </span>
          </div>
          <div className="whack-grid" role="group" aria-label="Mole garden">
            {Array.from({ length: 9 }, (_, i) => (
              <button
                key={i}
                type="button"
                className={`whack-hole ${active === i ? 'up' : ''}`}
                disabled={over}
                aria-label={`Hole ${i + 1}${active === i ? ', mole visible' : ''}`}
                onClick={() => whack(i)}
              >
                <span className="whack-mole" aria-hidden="true">
                  <i className="ear left" />
                  <i className="ear right" />
                  <i className="eye left" />
                  <i className="eye right" />
                  <i className="nose" />
                </span>
                <span className="whack-rim" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
    </Frame>
  );
}
