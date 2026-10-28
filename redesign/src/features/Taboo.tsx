import { KEYS, loadJSON } from '../lib/storage.ts';
import { useEffect, useRef, useState } from 'react';
import { Frame, useRun } from '../components/GameFrame.tsx';
import {
  CARDS,
  newTaboo,
  validTaboo,
  secondsLeft,
  scoreTaboo,
  finishTurn,
} from '../lib/taboo.ts';
import type { TabooState } from '../lib/taboo.ts';
export function TabooGame() {
  const run = useRun<TabooState>(
    'taboo',
    { duration: '60', turns: '4' },
    validTaboo,
    (s) =>
      newTaboo(
        [30, 60, 90].includes(Number(s.duration)) ? Number(s.duration) : 60,
        [4, 6, 8].includes(Number(s.turns)) ? Number(s.turns) : 4,
      ),
    (s) => s.turn >= s.turns,
  );
  const [visible, setVisible] = useState(false),
    [now, setNow] = useState(Date.now());
  const game = run.state,
    latest = useRef(game);
  latest.current = game;
  const done = !!game && game.turn >= game.turns;
  useEffect(() => {
    if (game)
      run.setSettings((s) => ({
        ...s,
        duration: String(game.duration),
        turns: String(game.turns),
      }));
    else {
      const saved =
        loadJSON<{ duration?: unknown; turns?: unknown } | null>(
          `${KEYS.SETTINGS}:taboo`,
          null,
        ) ?? {};
      run.setSettings((s) => ({
        duration: [30, 60, 90].includes(Number(saved.duration))
          ? String(saved.duration)
          : s.duration,
        turns: [4, 6, 8].includes(Number(saved.turns))
          ? String(saved.turns)
          : s.turns,
      }));
    }
  }, []);
  useEffect(() => {
    if (!game) setVisible(false);
  }, [game]);
  function expire(s: TabooState) {
    if (
      s.phase !== 'playing' ||
      s.deadline === null ||
      secondsLeft(s.deadline) > 0
    )
      return false;
    const next = finishTurn(s);
    run.commit(next, next.turn >= next.turns);
    setVisible(false);
    return true;
  }
  useEffect(() => {
    if (!game || game.phase !== 'playing' || done) return;
    const clock = setInterval(() => {
      setNow(Date.now());
      const current = latest.current;
      if (current) expire(current);
    }, 100);
    return () => clearInterval(clock);
  }, [game?.deadline, done]);
  function reveal() {
    if (!game || done || expire(game)) return;
    if (game.phase === 'ready') {
      const next: TabooState = {
        ...game,
        phase: 'playing',
        deadline: Date.now() + game.duration * 1000,
      };
      run.commit(next);
      setNow(Date.now());
    }
    setVisible(true);
  }
  function score(points: number) {
    if (!game || expire(game)) return;
    const next = scoreTaboo(game, points);
    if (next) run.commit(next);
  }
  function again() {
    setVisible(false);
    run.start();
  }
  const result = done
    ? game!.scores[0] === game!.scores[1]
      ? 'It’s a tie!'
      : `Team ${game!.scores[0] > game!.scores[1] ? 1 : 2} wins!`
    : '';
  return (
    <Frame
      run={run}
      fields={[
        {
          key: 'duration',
          label: 'Seconds per turn',
          options: [30, 60, 90].map((n) => [String(n), `${n} seconds`]),
        },
        {
          key: 'turns',
          label: 'Total turns',
          options: [4, 6, 8].map((n) => [String(n), `${n} turns`]),
        },
      ]}
      summary="Big clues. Forbidden words. Two teams."
      title={
        done
          ? 'Final scores'
          : `Team ${((game?.turn ?? 0) % 2) + 1} · turn ${(game?.turn ?? 0) + 1} of ${game?.turns ?? run.settings.turns}`
      }
      status={
        done
          ? result
          : visible
            ? 'The group judges clues. Correct +1 · Skip 0 · Forbidden word −1.'
            : game?.phase === 'playing'
              ? 'Turn in progress — the timer keeps running. Return to the clue giver.'
              : 'Pass to the next clue giver. Guessers, look away; an opposing player checks the card.'
      }
      help="Split into two teams. The clue giver describes the target without using the forbidden words, word parts, rhymes or gestures. An opposing player judges. Correct earns one, forbidden words lose one, and skips score zero."
      after={
        done && (
          <button className="primary" onClick={again}>
            Play again
          </button>
        )
      }
    >
      {game && (
        <div className="taboo-table">
          <div className="taboo-score">
            <span>
              Team 1 <b>{game.scores[0]}</b>
            </span>
            <span>
              Team 2 <b>{game.scores[1]}</b>
            </span>
          </div>
          {!done &&
            (!visible ? (
              <button className="primary taboo-reveal" onClick={reveal}>
                {game.phase === 'playing'
                  ? 'Reveal card and continue'
                  : 'Start timed turn'}
              </button>
            ) : (
              <>
                <p className="taboo-clock">
                  {secondsLeft(game.deadline!, now)} seconds left
                </p>
                <div className="taboo-card">
                  <p>Describe this</p>
                  <h3>{CARDS[game.deck[game.index]][0]}</h3>
                  <strong>Do not say</strong>
                  <ul>
                    {CARDS[game.deck[game.index]].slice(1).map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
                <div className="taboo-actions">
                  <button className="primary" onClick={() => score(1)}>
                    Correct +1
                  </button>
                  <button className="quiet" onClick={() => score(0)}>
                    Skip · 0
                  </button>
                  <button className="quiet" onClick={() => score(-1)}>
                    Forbidden word −1
                  </button>
                </div>
                <button
                  className="quiet taboo-hide"
                  onClick={() => setVisible(false)}
                >
                  Hide card
                </button>
              </>
            ))}
        </div>
      )}
    </Frame>
  );
}
