import { validCrazyEightsCheckpoint, validUnoCheckpoint } from './cards.ts';
import { validBlackjack } from './blackjack.ts';
import { isValidState } from './tictactoe.ts';
import type { LocalState } from './tictactoe.ts';
import { puzzleValidators, PUZZLE_IDS } from './puzzles.ts';
import type { PuzzleId } from './puzzles.ts';
export function validCheckpoint(id: string, state: unknown): boolean {
  if (id === 'crazy-eights') return validCrazyEightsCheckpoint(state);
  if (id === 'uno') return validUnoCheckpoint(state);
  if (id === 'blackjack') return validBlackjack(state);
  return id === 'tictactoe'
    ? isValidState(state as LocalState)
    : PUZZLE_IDS.includes(id as PuzzleId)
      ? puzzleValidators[id as PuzzleId](state)
      : false;
}
export const roomGameIds = new Set([
  'tictactoe',
  'connect-four',
  'crazy-eights',
  'uno',
]);
