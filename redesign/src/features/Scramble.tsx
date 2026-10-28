import { useEffect, useState } from 'react';
import { Frame, useRun } from '../components/GameFrame.tsx';
import { newScramble, nextScramble, validScramble } from '../lib/scramble.ts';
import type { ScrambleState } from '../lib/scramble.ts';
export function ScrambleGame() {
  const run = useRun<ScrambleState>(
    'word-scramble',
    { rounds: '8' },
    validScramble,
    (s) => newScramble(['5', '8', '12'].includes(s.rounds) ? s.rounds : '8'),
    (s) => s.round > Number(s.rounds),
  );
  const [input, setInput] = useState(''),
    [feedback, setFeedback] = useState('');
  const game = run.state,
    done = !!game && game.round > Number(game.rounds);
  useEffect(() => {
    if (game) run.setSettings((s) => ({ ...s, rounds: game.rounds }));
  }, []);
  useEffect(() => {
    if (!game) {
      setInput('');
      setFeedback('');
    }
  }, [game]);
  function advance() {
    if (!game || done) return;
    const next = nextScramble(game);
    run.commit(next, next.round > Number(next.rounds));
    setInput('');
    setFeedback('');
  }
  useEffect(() => {
    if (!game || !game.solved || done) return;
    const timer = setTimeout(advance, 900);
    return () => clearTimeout(timer);
  }, [game]);
  function guess() {
    if (!game || done || game.solved) return;
    if (input.trim().toUpperCase() !== game.word) {
      setFeedback('Not quite — try again.');
      return;
    }
    run.commit({ ...game, solved: true, correctCount: game.correctCount + 1 });
    setFeedback('Correct!');
  }
  function again() {
    setInput('');
    setFeedback('');
    run.start();
  }
  return (
    <Frame
      run={run}
      fields={[
        {
          key: 'rounds',
          label: 'Rounds',
          options: [5, 8, 12].map((n) => [String(n), `${n} words`]),
        },
      ]}
      summary="Unshuffle a little word magic."
      title={
        done
          ? 'All done!'
          : `Word ${game?.round ?? 1} of ${game?.rounds ?? run.settings.rounds}`
      }
      status={
        done
          ? `You solved ${game!.correctCount} of ${game!.rounds} words.`
          : feedback ||
            (game?.hinted
              ? `Starts with ${game.word[0]}.`
              : 'Arrange the letters into a word.')
      }
      help="Type the word made from the shuffled letters. Ask for a hint to see its first letter, or skip to the next word. Solve as many as you can in 5, 8 or 12 rounds."
      after={
        done && (
          <button className="primary" onClick={again}>
            Play again
          </button>
        )
      }
    >
      {game && !done && (
        <div className="scramble-table">
          <p>
            {game.word.length} letters · {game.correctCount} solved
          </p>
          <div
            className="scramble-letters"
            role="group"
            aria-label={`Shuffled letters: ${game.letters.join(' ')}`}
          >
            {game.letters.map((ch, i) => (
              <span aria-hidden="true" key={i}>
                {ch}
              </span>
            ))}
          </div>
          <form
            className="scramble-form"
            onSubmit={(e) => {
              e.preventDefault();
              guess();
            }}
          >
            <label>
              Your answer
              <input
                value={input}
                autoComplete="off"
                autoCapitalize="characters"
                disabled={game.solved}
                onChange={(e) => {
                  setInput(e.target.value);
                  setFeedback('');
                }}
              />
            </label>
            <button className="primary" disabled={game.solved}>
              Guess
            </button>
          </form>
          <div className="scramble-actions">
            <button
              className="quiet"
              disabled={game.solved}
              onClick={() => {
                run.commit({
                  ...game,
                  hinted: true,
                  hintsUsed: game.hintsUsed + 1,
                });
                setFeedback(`Starts with ${game.word[0]}.`);
              }}
            >
              Hint
            </button>
            <button className="quiet" disabled={game.solved} onClick={advance}>
              Skip word
            </button>
          </div>
        </div>
      )}
    </Frame>
  );
}
