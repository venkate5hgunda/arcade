import type { LocalState } from './tictactoe.ts';
import { findWin } from './tictactoe.ts';
import { c4Win } from './puzzles.ts';
import type {
  TileState,
  MineState,
  MemoryState,
  SimonState,
} from './puzzles.ts';
import type { BlackjackState } from './blackjack.ts';
import type { EightState, UnoState } from './cards.ts';
import { finishedCards, wrapCards } from './cards.ts';
import type { SnakesState, LudoState } from './races.ts';
import type { ChessState } from './chess.ts';
import { chessResult } from './chess.ts';
import type { RpsState } from './rps.ts';
import { rpsWinner } from './rps.ts';
import type { HangmanState } from './hangman.ts';
import type { WordleState } from './wordle.ts';
import type { ScrambleState } from './scramble.ts';
import type { WhackState } from './whack.ts';
import type { TabooState } from './taboo.ts';
import type { CharadesState } from './charades.ts';
import type { ShowState } from './show.ts';
import type { ImposterState } from './imposter.ts';
import type { BusinessState } from './business-core.js';
import type { IslandState } from './catan-core.js';
import type { RoomSnapshot } from './room/protocol.ts';
export interface GameCue {
  sound:
    | 'tap'
    | 'pop'
    | 'chime'
    | 'buzz'
    | 'buzzer'
    | 'rattle'
    | 'tick'
    | 'tickLow';
  haptic?: 'light' | 'selection' | 'success' | 'failure';
}
const win: GameCue = { sound: 'chime', haptic: 'success' };
const loss: GameCue = { sound: 'buzz', haptic: 'failure' };
const draw: GameCue = { sound: 'tickLow' };
const move: GameCue = { sound: 'tap', haptic: 'selection' };
const pop: GameCue = { sound: 'pop', haptic: 'light' };
const timer: GameCue = { sound: 'buzzer', haptic: 'failure' };
const dice: GameCue = { sound: 'rattle', haptic: 'light' };
const rolledDice = (
  a: { rolled: unknown; setupRolls: unknown },
  b: { rolled: unknown; setupRolls: unknown },
) =>
  (b.rolled !== null &&
    JSON.stringify(a.rolled) !== JSON.stringify(b.rolled)) ||
  JSON.stringify(a.setupRolls) !== JSON.stringify(b.setupRolls);
/** Classify accepted transitions, never rendered text or a generic completion flag. */
export function localCue(
  id: string,
  previous: object | null,
  next: object,
  justFinished = false,
): GameCue | null {
  if (id === 'blackjack') {
    const a = previous as BlackjackState | null,
      b = next as BlackjackState;
    if (b.result && (!a || a.round !== b.round || !a.result))
      return b.result === 'win' ? win : b.result === 'loss' ? loss : draw;
    return a && (b.round !== a.round || b.player.length !== a.player.length)
      ? pop
      : null;
  }
  if (!previous) return null;
  if (id === 'whack-a-mole' && justFinished) return timer;
  if (JSON.stringify(previous) === JSON.stringify(next)) return null;
  switch (id) {
    case 'tictactoe':
    case 'connect-four': {
      const a = previous as LocalState,
        b = next as LocalState;
      if (b.over && !a.over)
        return (id === 'tictactoe' ? findWin(b.board) : c4Win(b.board))
          ? b.mode === 'ai' && b.current === 2
            ? loss
            : win
          : draw;
      return a.board.some((value, i) => value !== b.board[i]) ? move : null;
    }
    case '2048': {
      const a = previous as TileState,
        b = next as TileState;
      return b.won && !a.won
        ? win
        : b.over && !a.over
          ? timer
          : b.score > a.score
            ? pop
            : move;
    }
    case 'minesweeper': {
      const a = previous as MineState,
        b = next as MineState;
      return b.over && !a.over ? (b.won ? win : loss) : pop;
    }
    case 'memory': {
      const a = previous as MemoryState,
        b = next as MemoryState;
      return b.cards.some((c, i) => c.matched && !a.cards[i].matched)
        ? win
        : b.cards.filter((c) => c.revealed).length >
            a.cards.filter((c) => c.revealed).length
          ? move
          : null;
    }
    case 'simon': {
      const a = previous as SimonState,
        b = next as SimonState;
      return b.over && !a.over
        ? timer
        : b.playerStep === b.sequence.length && a.playerStep < a.sequence.length
          ? win
          : null;
    }
    case 'snakes-ladders':
    case 'ludo': {
      const a = previous as SnakesState | LudoState,
        b = next as SnakesState | LudoState;
      return b.winner != null && a.winner == null
        ? win
        : 'awaiting' in b && a && 'awaiting' in a && a.awaiting && !b.awaiting
          ? pop
          : dice;
    }
    case 'crazy-eights':
    case 'uno': {
      const a = wrapCards(id, previous as EightState | UnoState),
        b = wrapCards(id, next as EightState | UnoState);
      return finishedCards(b) && !finishedCards(a)
        ? b.state.winner === null || b.state.winner === -1
          ? draw
          : win
        : b.state.hands.reduce((n, h) => n + h.length, 0) <
            a.state.hands.reduce((n, h) => n + h.length, 0)
          ? pop
          : move;
    }
    case 'chess': {
      const a = previous as ChessState,
        b = next as ChessState;
      if (b.over && !a.over) {
        const result = chessResult(b);
        return !result.winner
          ? draw
          : b.mode === 'ai' && result.winner !== b.side
            ? loss
            : win;
      }
      return b.captured.w.length + b.captured.b.length >
        a.captured.w.length + a.captured.b.length
        ? pop
        : move;
    }
    case 'rps': {
      const a = previous as RpsState,
        b = next as RpsState;
      if (b.phase === 'reveal' && a.phase !== 'reveal') {
        const winner = rpsWinner(b.p1Pick!, b.p2Pick!);
        return winner === null
          ? draw
          : b.mode === 'ai' && winner === 1
            ? loss
            : win;
      }
      return b.phase === 'countdown' && a.phase !== 'countdown'
        ? { sound: 'tick' }
        : move;
    }
    case 'hangman': {
      const a = previous as HangmanState,
        b = next as HangmanState;
      return b.guessed.length === a.guessed.length
        ? null
        : b.wrong > a.wrong
          ? b.wrong === 6
            ? timer
            : loss
          : [...b.word].every((c) => b.guessed.includes(c))
            ? win
            : pop;
    }
    case 'wordle': {
      const a = previous as WordleState,
        b = next as WordleState;
      return b.guesses.length > a.guesses.length
        ? b.guesses.includes(b.answer)
          ? win
          : b.guesses.length === 6
            ? timer
            : pop
        : null;
    }
    case 'word-scramble': {
      const a = previous as ScrambleState,
        b = next as ScrambleState;
      return b.correctCount > a.correctCount
        ? win
        : b.round !== a.round
          ? move
          : null;
    }
    case 'whack-a-mole': {
      const a = previous as WhackState,
        b = next as WhackState;
      return b.score > a.score ? pop : b.misses > a.misses ? move : null;
    }
    case 'taboo': {
      const a = previous as TabooState,
        b = next as TabooState;
      return b.phase === 'ready' && a.phase === 'playing'
        ? timer
        : b.scores.some((n, i) => n > a.scores[i])
          ? win
          : b.scores.some((n, i) => n < a.scores[i])
            ? loss
            : b.index !== a.index
              ? pop
              : null;
    }
    case 'dumb-charades': {
      const a = previous as CharadesState,
        b = next as CharadesState;
      return b.phase === 'scoring' && a.phase === 'acting'
        ? b.guessedCorrect
          ? win
          : loss
        : null;
    }
    case 'show-star': {
      const a = previous as ShowState,
        b = next as ShowState;
      return b.phase === 'scored' && a.phase !== 'scored'
        ? win
        : b.stack.length > a.stack.length
          ? pop
          : b.hands.some((hand, i) => hand.some((c, j) => c !== a.hands[i][j]))
            ? move
            : null;
    }
    case 'imposter': {
      const a = previous as ImposterState,
        b = next as ImposterState;
      return b.phase === 'result' && a.phase !== 'result'
        ? win
        : b.phase === 'verdict' && a.phase !== 'verdict'
          ? pop
          : b.phase !== a.phase
            ? move
            : null;
    }
    case 'business': {
      const a = previous as BusinessState,
        b = next as BusinessState;
      return b.phase === 'win' && a.phase !== 'win'
        ? win
        : a.phase === 'roll' && b.phase !== 'roll'
          ? dice
          : move;
    }
    case 'catan': {
      const a = previous as IslandState,
        b = next as IslandState;
      return b.winner !== null && a.winner === null
        ? win
        : rolledDice(a, b)
          ? dice
          : pop;
    }
    // Physics tables report impacts/goals at the solver callback, not on saved snapshots.
    default:
      return null;
  }
}

/** Room cues use public transitions and the recipient's result, never host-only state. */
export function roomCue(
  a: RoomSnapshot | null,
  b: RoomSnapshot | null,
  peerId: string,
): GameCue | null {
  if (!a || !b || a.roomId !== b.roomId) return null;
  const previous =
    a.islandMatch ??
    a.businessMatch ??
    a.mafiaMatch ??
    a.chessMatch ??
    a.rpsMatch ??
    a.raceMatch ??
    a.cardMatch ??
    a.match;
  const next =
    b.islandMatch ??
    b.businessMatch ??
    b.mafiaMatch ??
    b.chessMatch ??
    b.rpsMatch ??
    b.raceMatch ??
    b.cardMatch ??
    b.match;
  if (
    !previous ||
    !next ||
    previous.round !== next.round ||
    previous.revision === next.revision
  )
    return null;
  const seat = b.members.findIndex((m) => m.id === peerId);
  const old = a.standings?.players.find((p) => p.id === peerId),
    result = b.standings?.players.find((p) => p.id === peerId);
  if (seat >= 0 && result) {
    if (result.wins > (old?.wins ?? 0)) return win;
    if (result.losses > (old?.losses ?? 0)) return loss;
    if (result.draws > (old?.draws ?? 0)) return draw;
  }
  if (b.rpsMatch && a.rpsMatch) {
    const view = b.rpsMatch.view;
    if (
      view.phase === 'reveal' &&
      a.rpsMatch.view.phase !== 'reveal' &&
      view.revealed
    ) {
      const winner = rpsWinner(...view.revealed);
      return winner === null || seat === -1
        ? draw
        : winner === seat
          ? win
          : loss;
    }
    return view.phase === 'countdown' && a.rpsMatch.view.phase !== 'countdown'
      ? { sound: 'tick' }
      : null;
  }
  if (b.mafiaMatch && a.mafiaMatch) {
    const before = a.mafiaMatch.view,
      after = b.mafiaMatch.view;
    if (seat >= 0 && before.alive[seat] && !after.alive[seat]) return loss;
    if (after.phase !== before.phase)
      return after.phase === 'night'
        ? { sound: 'tickLow' }
        : after.phase === 'discussion'
          ? { sound: 'tick' }
          : pop;
    if (after.clues.length > before.clues.length) return pop;
    return move;
  }
  if (b.raceMatch) return dice;
  if (b.cardMatch && a.cardMatch)
    return b.cardMatch.view.counts.reduce((n, c) => n + c, 0) <
      a.cardMatch.view.counts.reduce((n, c) => n + c, 0)
      ? pop
      : move;
  if (b.chessMatch && a.chessMatch)
    return localCue('chess', a.chessMatch.game, b.chessMatch.game)?.sound ===
      'pop'
      ? pop
      : move;
  if (b.businessMatch && a.businessMatch)
    return a.businessMatch.view.phase === 'roll' &&
      b.businessMatch.view.phase !== 'roll'
      ? dice
      : pop;
  if (b.islandMatch && a.islandMatch)
    return rolledDice(a.islandMatch.view, b.islandMatch.view) ? dice : pop;
  return move;
}
