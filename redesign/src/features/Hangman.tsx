import { useEffect, useState } from 'react';
import { Frame, useRun } from '../components/GameFrame.tsx';
import {
  createHangman,
  guessHangman,
  validHangmanState,
  wordCategory,
  MAX_MISSES,
} from '../lib/hangman.ts';
import type { HangmanState } from '../lib/hangman.ts';
import { names as readNames } from '../lib/profile.ts';

export function HangmanGame() {
  const run = useRun<HangmanState>(
    'hangman',
    { players: '1' },
    validHangmanState,
    (s) => createHangman(s.players),
  );
  const [names] = useState(readNames),
    [feedback, setFeedback] = useState('Pick a letter or type A–Z.');
  const game = run.state;
  const won = !!game && [...game.word].every((ch) => game.guessed.includes(ch)),
    lost = !!game && game.wrong === MAX_MISSES,
    done = won || lost;
  const label = (player: number) => names[player - 1] || `Player ${player}`;
  useEffect(() => {
    if (game) run.setSettings((s) => ({ ...s, players: game.players }));
  }, []);
  useEffect(() => {
    if (!game) setFeedback('Pick a letter or type A–Z.');
  }, [game]);
  function guess(letter: string) {
    if (!game || done || game.guessed.includes(letter)) return;
    const result = guessHangman(game, letter);
    setFeedback(
      result.outcome === 'win'
        ? `${game.players === '1' ? 'You' : label(game.current)} found ${game.word}!`
        : result.outcome === 'loss'
          ? `The word was ${game.word}.`
          : result.correct
            ? `${letter} appears ${result.occurrences} ${result.occurrences === 1 ? 'time' : 'times'}.`
            : `${letter} is not in the word. ${MAX_MISSES - result.state.wrong} misses left.`,
    );
    run.commit(result.state, !!result.outcome);
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (/^[a-z]$/i.test(e.key)) guess(e.key.toUpperCase());
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  });
  function again() {
    setFeedback('A fresh word is ready. Pick a letter.');
    run.start();
  }
  return (
    <Frame
      run={run}
      fields={[
        {
          key: 'players',
          label: 'Players',
          options: [
            ['1', 'Solo'],
            ['2', '2 players'],
          ],
        },
      ]}
      summary="A little word detective work."
      title={
        done
          ? won
            ? 'Word discovered!'
            : 'A fresh chance awaits'
          : game?.players === '2'
            ? `${label(game.current)}’s turn`
            : 'Find the hidden word'
      }
      status={feedback}
      help="Guess letters to reveal the word before six misses. In two-player mode each guess passes the turn; the player who finds the final letter wins. Open the clue to see the category."
      after={
        done && (
          <button className="primary" onClick={again}>
            Next word
          </button>
        )
      }
    >
      {game && (
        <div className="hangman-table">
          <div className="hangman-progress">
            <strong>{MAX_MISSES - game.wrong} misses left</strong>
            <span aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => (
                <i key={i} className={i < game.wrong ? 'lost' : ''}>
                  ♥
                </i>
              ))}
            </span>
          </div>
          <div
            className="hangman-word"
            role="group"
            aria-label={`${game.word.length}-letter word`}
          >
            {[...game.word].map((ch, i) => (
              <span
                role="img"
                aria-label={
                  game.guessed.includes(ch) || done ? ch : 'Hidden letter'
                }
                className={game.guessed.includes(ch) ? 'found' : ''}
                key={i}
              >
                {game.guessed.includes(ch) || done ? ch : ''}
              </span>
            ))}
          </div>
          <div
            className="hangman-keys"
            role="group"
            aria-label="Choose a letter"
          >
            {[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((ch) => (
              <button
                key={ch}
                type="button"
                className={
                  game.guessed.includes(ch)
                    ? game.word.includes(ch)
                      ? 'found'
                      : 'missed'
                    : ''
                }
                disabled={done || game.guessed.includes(ch)}
                onClick={() => guess(ch)}
                aria-label={`${ch}${game.guessed.includes(ch) ? (game.word.includes(ch) ? ': found' : ': missed') : ''}`}
              >
                {ch}
              </button>
            ))}
          </div>
          <details className="hangman-clue">
            <summary>Need a clue?</summary>
            <p>The word belongs to: {wordCategory(game.word)}.</p>
          </details>
        </div>
      )}
    </Frame>
  );
}
