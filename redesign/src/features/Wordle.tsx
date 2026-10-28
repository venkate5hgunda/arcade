import { useEffect, useState } from 'react';
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
  function submit() {
    if (!game || done) return;
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
          : message || 'Type or tap five letters, then make your guess.'
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
          <form
            className="wordle-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label>
              Five letter guess
              <input
                aria-label="Five letter guess"
                value={input}
                maxLength={5}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={done}
                onChange={(e) => {
                  setInput(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z]/g, '')
                      .slice(0, 5),
                  );
                  setMessage('');
                }}
              />
            </label>
            <button className="primary" disabled={done}>
              Guess
            </button>
          </form>
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
          <div
            className="wordle-keyboard"
            role="group"
            aria-label="Letter keyboard"
          >
            {['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((row) => (
              <div className="wordle-key-row" key={row}>
                {[...row].map((letter) => (
                  <button
                    type="button"
                    className={`wordle-key ${keys[letter] || ''}`}
                    aria-label={`${letter}${keys[letter] ? ': ' + keys[letter] : ''}`}
                    disabled={done}
                    key={letter}
                    onClick={() => {
                      setInput((v) => (v + letter).slice(0, 5));
                      setMessage('');
                    }}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            ))}
            <button
              type="button"
              className="quiet"
              disabled={done}
              onClick={() => {
                setInput((v) => v.slice(0, -1));
                setMessage('');
              }}
            >
              Delete letter
            </button>
          </div>
          <p>✓ Correct spot · ↔ Wrong spot · × Not in word</p>
        </div>
      )}
    </Frame>
  );
}
