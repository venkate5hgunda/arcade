import { useEffect, useState } from 'react';
import { useLetterInput } from '../lib/letter-input.ts';
import { Frame, useRun } from '../components/GameFrame.tsx';
import {
  evaluateGuess,
  knownWord,
  newWordle,
  validWordle,
} from '../lib/wordle.ts';
import type { Mark, WordleState } from '../lib/wordle.ts';

export function WordleGame() {
  const run = useRun<WordleState>(
    'wordle',
    {},
    validWordle,
    newWordle,
    (s) => s.guesses.includes(s.answer) || s.guesses.length === 6,
  );
  const [input, setInput] = useState(''),
    [message, setMessage] = useState('');
  const game = run.state,
    done =
      !!game &&
      (game.guesses.includes(game.answer) || game.guesses.length === 6),
    won = !!game && game.guesses.includes(game.answer);
  useEffect(() => {
    if (!game) {
      setInput('');
      setMessage('');
    }
  }, [game]);
  const keys: Record<string, Mark> = {};
  const rank: Record<Mark, number> = { absent: 1, present: 2, correct: 3 };
  for (const guess of game?.guesses ?? [])
    evaluateGuess(guess, game!.answer).forEach((mark, i) => {
      if (!keys[guess[i]] || rank[mark] > rank[keys[guess[i]]])
        keys[guess[i]] = mark;
    });
  function letter(key: string) {
    setInput((value) => (value + key).slice(0, 5));
    setMessage('');
  }
  function erase() {
    setInput((value) => value.slice(0, -1));
    setMessage('');
  }
  useLetterInput(!!game && !done && !run.saving, letter, erase, submit);
  function submit() {
    if (!game || done || run.saving) return;
    if (input.length !== 5) {
      setMessage('Enter five letters.');
      return;
    }
    if (!knownWord(input)) {
      setMessage('That word is outside this practice word list. Try another.');
      return;
    }
    const next = { ...game, guesses: [...game.guesses, input] };
    run.commit(next, input === game.answer || next.guesses.length === 6);
    setInput('');
    setMessage('');
  }
  function again() {
    setInput('');
    setMessage('');
    run.start();
  }
  return (
    <Frame
      run={run}
      fields={[]}
      summary="Five letters, six chances. Find the word."
      title={
        done
          ? won
            ? 'Word solved!'
            : 'The word is revealed'
          : `Guess ${(game?.guesses.length ?? 0) + 1} of 6`
      }
      status={
        done
          ? won
            ? `Solved in ${game!.guesses.length}! The word is ${game!.answer}.`
            : `The word was ${game!.answer}. Try another!`
          : message || 'Tap or type five letters, then press Guess or Enter.'
      }
      help="Guess a five-letter word from the offline practice list. A check means the right letter in the right spot; an arrow means the letter belongs elsewhere; a cross means it is absent. You have six guesses."
      after={
        done && (
          <button className="primary" onClick={again}>
            New word
          </button>
        )
      }
    >
      {game && (
        <div className="wordle-table">
          <div className="wordle-board" role="group" aria-label="Guess board">
            {Array.from({ length: 6 }, (_, row) => {
              const guess = game.guesses[row],
                letters = guess || (row === game.guesses.length ? input : ''),
                marks = guess ? evaluateGuess(guess, game.answer) : [];
              return (
                <div className="wordle-row" key={row}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <span
                      className={`wordle-tile ${marks[i] || ''}`}
                      role="img"
                      aria-label={
                        letters[i]
                          ? `${letters[i]}: ${marks[i] || 'unsubmitted'}`
                          : 'Empty'
                      }
                      key={i}
                    >
                      {letters[i] || ''}
                      <small aria-hidden="true">
                        {marks[i]
                          ? { correct: '✓', present: '↔', absent: '×' }[
                              marks[i]
                            ]
                          : ''}
                      </small>
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
          {!done && (
            <div
              className="wordle-keyboard"
              role="group"
              aria-label="Letter keyboard"
            >
              {['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((row, index) => (
                <div className="wordle-key-row" key={row}>
                  {index === 2 && (
                    <button
                      type="button"
                      className="wordle-key wordle-action wordle-submit"
                      onClick={submit}
                    >
                      Guess
                    </button>
                  )}
                  {[...row].map((key) => (
                    <button
                      type="button"
                      className={`wordle-key ${keys[key] || ''}`}
                      aria-label={`${key}${keys[key] ? ': ' + keys[key] : ''}`}
                      key={key}
                      onClick={() => letter(key)}
                    >
                      {key}
                    </button>
                  ))}
                  {index === 2 && (
                    <button
                      type="button"
                      className="wordle-key wordle-action"
                      aria-label="Delete letter"
                      onClick={erase}
                    >
                      ⌫
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Frame>
  );
}
