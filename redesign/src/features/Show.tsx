import { useEffect, useRef, useState } from 'react';
import { Frame, useRun } from '../components/GameFrame.tsx';
import {
  SYMBOLS,
  validShow,
  newShow,
  matches,
  passChits,
  stackPoints,
} from '../lib/show.ts';
import type { ShowState } from '../lib/show.ts';
import { names as readNames } from '../lib/profile.ts';
import { KEYS, loadJSON } from '../lib/storage.ts';
export function ShowGame() {
  const run = useRun<ShowState>(
    'show-star',
    { players: '4', rounds: '3' },
    validShow,
    (s) =>
      newShow(
        Math.max(3, Math.min(8, Number(s.players) || 4)),
        [3, 5, 10].includes(Number(s.rounds)) ? Number(s.rounds) : 3,
      ),
    (s) => s.phase === 'scored' && s.round === s.rounds,
  );
  const [names] = useState(readNames),
    [revealed, setRevealed] = useState(false);
  const game = run.state,
    latest = useRef(game);
  latest.current = game;
  const label = (i: number) => names[i] || `Player ${i + 1}`;
  const done = !!game && game.phase === 'scored' && game.round === game.rounds;
  useEffect(() => {
    if (game)
      run.setSettings((s) => ({
        ...s,
        players: String(game.players),
        rounds: String(game.rounds),
      }));
    else {
      const saved =
        loadJSON<{ players?: unknown; rounds?: unknown } | null>(
          `${KEYS.SETTINGS}:show-star`,
          null,
        ) ?? {};
      run.setSettings((s) => ({
        players: [3, 4, 5, 6, 7, 8].includes(Number(saved.players))
          ? String(saved.players)
          : s.players,
        rounds: [3, 5, 10].includes(Number(saved.rounds))
          ? String(saved.rounds)
          : s.rounds,
      }));
    }
  }, []);
  useEffect(() => {
    if (!game) setRevealed(false);
  }, [game]);
  function commit(next: ShowState) {
    latest.current = next;
    run.commit(next, next.phase === 'scored' && next.round === next.rounds);
  }
  function choose(i: number) {
    const s = latest.current;
    if (!s || s.phase !== 'passing') return;
    const picks = [...s.picks, i];
    const next =
      picks.length === s.players
        ? { ...s, picks: [], hands: passChits(s.hands, picks) }
        : { ...s, picks };
    setRevealed(false);
    commit(next);
  }
  function slapFirst() {
    const s = latest.current;
    if (!s || s.phase !== 'passing' || !matches(s.hands[s.picks.length]))
      return;
    setRevealed(false);
    commit({ ...s, phase: 'slapping', stack: [s.picks.length] });
  }
  function slap(i: number) {
    const s = latest.current;
    if (!s || s.phase !== 'slapping' || s.stack.includes(i)) return;
    const stack = [...s.stack, i];
    if (stack.length === s.players) {
      const points = stackPoints(stack, s.players);
      commit({
        ...s,
        stack,
        phase: 'scored',
        scores: s.scores.map((n, j) => n + points[j]),
      });
    } else commit({ ...s, stack });
  }
  function nextRound() {
    if (!game) return;
    setRevealed(false);
    if (done) run.start();
    else
      commit(newShow(game.players, game.rounds, game.scores, game.round + 1));
  }
  const actor = game?.picks.length ?? 0,
    winners =
      game && done
        ? game.scores
            .map((n, i) => (n === Math.max(...game.scores) ? label(i) : null))
            .filter(Boolean)
            .join(' & ')
        : '';
  return (
    <Frame
      run={run}
      fields={[
        {
          key: 'players',
          label: 'Players',
          options: [3, 4, 5, 6, 7, 8].map((n) => [String(n), `${n} players`]),
        },
        {
          key: 'rounds',
          label: 'Rounds',
          options: [3, 5, 10].map((n) => [String(n), `${n} rounds`]),
        },
      ]}
      summary="Match four. Palm down. Race for the stack."
      title={
        done
          ? `${winners} ${winners?.includes(' & ') ? 'win' : 'wins'}!`
          : `Round ${game?.round ?? 1} of ${game?.rounds ?? run.settings.rounds}`
      }
      status={
        !game
          ? 'Gather around one shared device.'
          : game.phase === 'passing'
            ? revealed
              ? `${label(actor)}: choose one chit to pass clockwise, or slap with four matching.`
              : `Pass to ${label(actor)}. Everyone else, look away.`
            : game.phase === 'slapping'
              ? 'Everyone: tap your own SLAP pad. First tap is the lowest hand.'
              : 'Stack complete — the lowest hand earns the most points.'
      }
      help="Each player secretly picks one chit to pass clockwise. After everyone picks, the chits move together. If your four chits match, slap first; everyone else taps their own pad. Earlier slaps earn more points. Keep hands covered between players."
      after={
        game?.phase === 'scored' && (
          <button className="primary" onClick={nextRound}>
            {done ? 'Play again' : 'Next round'}
          </button>
        )
      }
    >
      {game && (
        <div className="show-table">
          <div className="show-scores" aria-label="Scores">
            {game.scores.map((score, i) => (
              <span key={i}>
                {label(i)} <b>{score}</b>
              </span>
            ))}
          </div>
          {game.phase === 'passing' ? (
            revealed ? (
              <>
                <div
                  className="show-hand"
                  role="group"
                  aria-label="Your four chits"
                >
                  {game.hands[actor].map((chit, i) => (
                    <button
                      className="show-chit"
                      key={i}
                      onClick={() => choose(i)}
                      aria-label={`${SYMBOLS[chit]}, pass chit ${i + 1}`}
                    >
                      <span aria-hidden="true">
                        {SYMBOLS[chit].split(' ')[0]}
                      </span>
                      <small>{SYMBOLS[chit].slice(2)}</small>
                    </button>
                  ))}
                </div>
                {matches(game.hands[actor]) && (
                  <button className="primary" onClick={slapFirst}>
                    SLAP! I have four matching
                  </button>
                )}
              </>
            ) : (
              <button
                className="primary show-reveal"
                onClick={() => setRevealed(true)}
              >
                Reveal my four chits
              </button>
            )
          ) : (
            <div className="show-pads" role="group" aria-label="Slap pads">
              {Array.from({ length: game.players }, (_, i) => {
                const rank = game.stack.indexOf(i);
                return (
                  <button
                    key={i}
                    className="show-pad"
                    disabled={rank >= 0 || game.phase !== 'slapping'}
                    onPointerDown={(e) => {
                      if (e.button === 0) {
                        e.preventDefault();
                        slap(i);
                      }
                    }}
                    onClick={(e) => {
                      if (e.detail === 0) slap(i);
                    }}
                  >
                    {rank < 0
                      ? `${label(i)} — SLAP!`
                      : `${label(i)} · #${rank + 1} · +${game.players - rank}`}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Frame>
  );
}
