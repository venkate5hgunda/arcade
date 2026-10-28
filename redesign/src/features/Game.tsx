import { BusinessGame } from './Business.tsx';
import { IslandGame } from './Island.tsx';
import { feedback } from '../lib/feedback.ts';
import { MafiaGame } from './Mafia.tsx';
import { PoolGame } from './Pool.tsx';
import { HockeyGame } from './Hockey.tsx';
import { ImposterGame } from './Imposter.tsx';
import { CharadesGame } from './Charades.tsx';
import { ChessGame } from './Chess.tsx';
import { RpsGame } from './Rps.tsx';
import { ShowGame } from './Show.tsx';
import { TabooGame } from './Taboo.tsx';
import { WhackGame } from './Whack.tsx';
import { ScrambleGame } from './Scramble.tsx';
import { HangmanGame } from './Hangman.tsx';
import { WordleGame } from './Wordle.tsx';
import { RacesGame } from './Races.tsx';
import { CardsGame } from './Cards.tsx';
import { GameArt } from '../components/GameArt.tsx';
import { BlackjackGame } from './Blackjack.tsx';
import { PuzzleGame } from './Puzzles.tsx';
import { PUZZLE_IDS } from '../lib/puzzles.ts';
import type { PuzzleId } from '../lib/puzzles.ts';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GAMES } from '../lib/games.ts';
import {
  applyMove,
  aiMove,
  emptyBoard,
  findWin,
  isValidState,
} from '../lib/tictactoe.ts';
import type { LocalState, Mode } from '../lib/tictactoe.ts';
import { createGameSession } from '../lib/session.ts';
import { KEYS, loadJSON, saveJSON } from '../lib/storage.ts';
import {
  names as readNames,
  markPlayed,
  localScores,
  recordWin,
} from '../lib/profile.ts';
import { Board } from '../components/Board.tsx';

function LocalGame() {
  const session = useMemo(() => createGameSession('tictactoe'), []);
  const [state, setState] = useState<LocalState | null>(() => {
    if (isValidState(session.state as LocalState))
      return session.state as LocalState;
    if (session.state) session.finish();
    return null;
  });
  const [mode, setMode] = useState<Mode>(() => {
    const saved = loadJSON<{ mode?: string } | null>(
      `${KEYS.SETTINGS}:tictactoe`,
      null,
    );
    return state?.mode ?? (saved?.mode === 'pvp' ? 'pvp' : 'ai');
  });
  const [names, setNames] = useState(readNames);
  const [scores, setScores] = useState(localScores);
  const [confirm, setConfirm] = useState(false);
  const win = state && findWin(state.board);
  const finished = !!state?.over;
  const label = (seat: number) =>
    state?.mode === 'ai' && seat === 2
      ? 'Computer'
      : names[seat - 1]?.trim() || `Player ${seat}`;
  function commit(next: LocalState) {
    setState(next);
    if (next.over) {
      session.finish();
      feedback.win();
      if (findWin(next.board))
        setScores(
          recordWin(
            next.mode === 'ai' && next.current === 2
              ? 'Computer'
              : names[next.current - 1]?.trim() || `Player ${next.current}`,
          ),
        );
    } else session.save(next);
  }
  useEffect(() => {
    if (!state || state.over || state.mode !== 'ai' || state.current !== 2)
      return;
    const timer = setTimeout(() => {
      const result = applyMove(state.board, 2, aiMove(state.board, 2, 1));
      commit({
        mode: 'ai',
        board: result.board,
        current: result.current,
        over: result.finished,
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [state]);
  function start() {
    saveJSON(`${KEYS.SETTINGS}:tictactoe`, { mode });
    markPlayed('tictactoe');
    commit({ mode, board: emptyBoard(), current: 1, over: false });
  }
  function move(cell: number) {
    if (!state || finished || (state.mode === 'ai' && state.current === 2))
      return;
    const result = applyMove(state.board, state.current, cell);
    commit({
      mode: state.mode,
      board: result.board,
      current: result.current,
      over: result.finished,
    });
  }
  return (
    <section className="play-page">
      <Link className="back" to="/">
        ← Back to the shelf
      </Link>
      <div className="game-heading">
        <div>
          <p className="eyebrow">A little friendly competition</p>
          <h1>Tic-Tac-Toe</h1>
        </div>
        {state && (
          <button className="quiet" onClick={() => setConfirm(true)}>
            New match
          </button>
        )}
      </div>
      {!state ? (
        <div className="setup-layout">
          <div>
            <p className="lede">Small board. Big rivalry. Make your mark.</p>
            <div className="setup-card">
              <div className="setup-summary">
                <div>
                  <h2>Ready when you are</h2>
                  <p>
                    {mode === 'ai'
                      ? 'You vs. the computer · X goes first'
                      : 'Two friends, one screen · X goes first'}
                  </p>
                </div>
                <button className="primary" onClick={start}>
                  Start playing <span aria-hidden="true">→</span>
                </button>
              </div>
              <details>
                <summary>Match options & player names</summary>
                <fieldset>
                  <legend>Play style</legend>
                  <div className="segmented">
                    <button
                      aria-pressed={mode === 'ai'}
                      onClick={() => setMode('ai')}
                    >
                      Vs computer
                    </button>
                    <button
                      aria-pressed={mode === 'pvp'}
                      onClick={() => setMode('pvp')}
                    >
                      2 players
                    </button>
                  </div>
                </fieldset>
                {[0, ...(mode === 'pvp' ? [1] : [])].map((index) => (
                  <label key={index}>
                    Player {index + 1}
                    <input
                      maxLength={24}
                      value={names[index] ?? ''}
                      placeholder={`Player ${index + 1}`}
                      onChange={(event) => {
                        const next = [...names];
                        next[index] = event.target.value;
                        setNames(next);
                        saveJSON(KEYS.PLAYER_NAMES, next);
                      }}
                    />
                  </label>
                ))}
              </details>
            </div>
            <Link className="room-callout" to="/room">
              <img src="./icons/users.svg" alt="" />
              Different screens? Start a private room{' '}
              <span aria-hidden="true">→</span>
            </Link>
            <Help />
          </div>
          <GameArt id="tictactoe" className="setup-art" eager />
        </div>
      ) : (
        <div className="match-layout">
          <div className="board-panel">
            <div
              className={`turn-banner ${finished ? 'finished' : ''}`}
              role="status"
            >
              <span
                className={`turn-token ${state.current === 1 ? 'x-text' : 'o-text'}`}
              >
                {finished
                  ? win
                    ? 'WIN'
                    : 'TIE'
                  : state.current === 1
                    ? 'X'
                    : 'O'}
              </span>
              <div>
                <h2>
                  {finished
                    ? win
                      ? `${label(state.current)} wins!`
                      : 'A beautifully played draw.'
                    : state.mode === 'ai' && state.current === 2
                      ? 'Computer is thinking…'
                      : `${label(state.current)}’s turn`}
                </h2>
                <p>
                  {finished
                    ? 'Ready for a rematch?'
                    : state.mode === 'ai' && state.current === 2
                      ? 'Finding the next move'
                      : 'Choose an empty square. Make it count.'}
                </p>
              </div>
            </div>
            <Board
              board={state.board}
              blocked={finished || (state.mode === 'ai' && state.current === 2)}
              move={move}
            />
            <div className="score-line">
              <span>
                <b className="x-text">X</b> {label(1)}{' '}
                <strong>{scores[label(1)] ?? 0}</strong>
              </span>
              <span>
                <b className="o-text">O</b> {label(2)}{' '}
                <strong>{scores[label(2)] ?? 0}</strong>
              </span>
            </div>
            {finished && (
              <button className="primary rematch" onClick={start}>
                Play again <span aria-hidden="true">↻</span>
              </button>
            )}
          </div>
          <aside>
            <Help />
            <details className="help-card">
              <summary>Match details</summary>
              <p>
                {state.mode === 'ai'
                  ? 'You are X. The computer is O and plays perfectly. Your best result is a draw!'
                  : 'Pass the device after each turn. X always starts.'}
              </p>
              <p>Wins are saved for each player on this device.</p>
            </details>
          </aside>
        </div>
      )}
      {confirm && (
        <div className="modal-backdrop">
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-title"
          >
            <h2 id="reset-title">Start a fresh match?</h2>
            <p>Your current board will be cleared.</p>
            <div className="actions">
              <button
                autoFocus
                className="quiet"
                onClick={() => setConfirm(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setConfirm(false);
                  if (e.key === 'Tab' && e.shiftKey) {
                    e.preventDefault();
                    (e.currentTarget.nextElementSibling as HTMLElement).focus();
                  }
                }}
              >
                Keep playing
              </button>
              <button
                className="primary"
                onClick={() => {
                  session.finish();
                  setState(null);
                  setConfirm(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setConfirm(false);
                  if (e.key === 'Tab' && !e.shiftKey) {
                    e.preventDefault();
                    (
                      e.currentTarget.previousElementSibling as HTMLElement
                    ).focus();
                  }
                }}
              >
                New match
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
function Help() {
  return (
    <details className="help-card">
      <summary>How to play</summary>
      <p>
        Take turns placing X and O. The first line of three across, down, or
        diagonally wins.
      </p>
      <p>
        Use arrow keys to move between squares. Press Enter or Space to place a
        mark.
      </p>
    </details>
  );
}
export function GameRoute() {
  const { id } = useParams();
  const game = GAMES.find((g) => g.id === id);
  if (!game)
    return (
      <section className="detail">
        <Link to="/">← Back to the shelf</Link>
        <h1>Game not found</h1>
        <p>Choose one of the games on the shelf.</p>
      </section>
    );
  if (game.id === 'snakes-ladders' || game.id === 'ludo')
    return <RacesGame id={game.id} key={game.id} />;
  if (game.id === 'crazy-eights' || game.id === 'uno')
    return <CardsGame id={game.id} key={game.id} />;
  if (game.id === 'business') return <BusinessGame key={game.id} />;
  if (game.id === 'catan') return <IslandGame key={game.id} />;
  if (game.id === 'mafia') return <MafiaGame key={game.id} />;
  if (game.id === 'pool') return <PoolGame key={game.id} />;
  if (game.id === 'air-hockey') return <HockeyGame key={game.id} />;
  if (game.id === 'imposter') return <ImposterGame key={game.id} />;
  if (game.id === 'dumb-charades') return <CharadesGame key={game.id} />;
  if (game.id === 'chess') return <ChessGame key={game.id} />;
  if (game.id === 'rps') return <RpsGame key={game.id} />;
  if (game.id === 'show-star') return <ShowGame key={game.id} />;
  if (game.id === 'taboo') return <TabooGame key={game.id} />;
  if (game.id === 'whack-a-mole') return <WhackGame key={game.id} />;
  if (game.id === 'word-scramble') return <ScrambleGame key={game.id} />;
  if (game.id === 'hangman') return <HangmanGame key={game.id} />;
  if (game.id === 'wordle') return <WordleGame key={game.id} />;
  if (game.id === 'blackjack') return <BlackjackGame key={game.id} />;
  if (game.id === 'tictactoe') return <LocalGame key={game.id} />;
  if (PUZZLE_IDS.includes(game.id as PuzzleId))
    return <PuzzleGame id={game.id as PuzzleId} key={game.id} />;
  return (
    <section className="detail">
      <Link className="back" to="/">
        ← Back to the shelf
      </Link>
      <GameArt id={game.id} className="detail-art" eager />
      <p className="eyebrow">{game.category} · Joining the new shelf soon</p>
      <h1>{game.name}</h1>
      <p className="lede">{game.description}</p>
      <p>
        This game’s redesigned experience is still in progress. The original
        Arcade has the complete collection.
      </p>
      <a
        className="primary"
        href={`https://venkate5hgunda.github.io/arcade/#/games/${game.id}`}
        target="_blank"
        rel="noreferrer"
      >
        Play in original Arcade ↗
      </a>
    </section>
  );
}
