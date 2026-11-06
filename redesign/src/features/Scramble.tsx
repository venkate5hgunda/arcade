import { playCue } from '../lib/feedback.ts';
import { useEffect, useState } from 'react';
import { useLetterInput } from '../lib/letter-input.ts';
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
  const [picked, setPicked] = useState<number[]>([]),
    [feedback, setFeedback] = useState('');
  const game = run.state,
    done = !!game && game.round > Number(game.rounds);
  useEffect(() => {
    if (game) run.setSettings((s) => ({ ...s, rounds: game.rounds }));
  }, []);
  useEffect(() => {
    if (!game) {
      setPicked([]);
      setFeedback('');
    }
  }, [game]);
  function advance() {
    if (!game || done) return;
    const next = nextScramble(game);
    run.commit(next, next.round > Number(next.rounds));
    setPicked([]);
    setFeedback('');
  }
  useEffect(() => {
    if (!game || !game.solved || done) return;
    const timer = setTimeout(advance, 900);
    return () => clearTimeout(timer);
  }, [game]);
  const answer = picked.map((index) => game?.letters[index]).join('');
  function letter(key: string) {
    setPicked((current) => {
      const index = game?.letters.findIndex(
        (tile, i) => tile === key && !current.includes(i),
      );
      return index === undefined || index < 0 ? current : [...current, index];
    });
    setFeedback('');
  }
  function erase() {
    setPicked((current) => current.slice(0, -1));
    setFeedback('');
  }
  useLetterInput(
    !!game && !done && !game.solved && !run.saving,
    letter,
    erase,
    guess,
  );
  function guess() {
    if (!game || done || game.solved || run.saving) return;
    if (answer !== game.word) {
      playCue({ sound: 'buzz', haptic: 'failure' });
      setFeedback('Not quite — try again.');
      return;
    }
    run.commit({ ...game, solved: true, correctCount: game.correctCount + 1 });
    setFeedback('Correct!');
  }
  function again() {
    setPicked([]);
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
              : 'Tap or type the tiles to build a word.')
      }
      help="Tap the shuffled tiles or type their letters to build the word. Use Delete or Backspace to undo, and Guess or Enter to submit. Ask for a hint to see its first letter, or skip to the next word. Solve as many as you can in 5, 8 or 12 rounds."
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
          <output className="scramble-answer" aria-label="Your answer">
            {answer || 'Tap the letters below'}
          </output>
          <div
            className="scramble-letters"
            role="group"
            aria-label="Shuffled letters"
          >
            {game.letters.map((ch, i) => (
              <button
                type="button"
                key={i}
                disabled={game.solved || picked.includes(i)}
                onClick={() => {
                  setPicked((current) =>
                    current.includes(i) ? current : [...current, i],
                  );
                  setFeedback('');
                }}
              >
                {ch}
              </button>
            ))}
          </div>
          <div className="scramble-actions">
            <button
              className="quiet"
              disabled={game.solved || !picked.length}
              onClick={erase}
            >
              Delete letter
            </button>
            <button
              className="primary"
              disabled={game.solved || picked.length !== game.letters.length}
              onClick={guess}
            >
              Guess
            </button>
          </div>
          <div className="scramble-actions">
            <button
              className="quiet"
              disabled={game.solved}
              onClick={async () => {
                await run.commit({
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
