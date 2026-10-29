import { validBusiness } from './business-core.js';
import { validCatanCheckpoint } from './catan-core.js';
import { validPool } from './pool.ts';
import { validHockey } from './hockey.ts';
import { validImposter } from './imposter.ts';
import { validCharades } from './charades.ts';
import { validChess } from './chess.ts';
import { validRps } from './rps.ts';
import { validShow } from './show.ts';
import { validTaboo } from './taboo.ts';
import { validWhack } from './whack.ts';
import { validScramble } from './scramble.ts';
import { validHangmanState } from './hangman.ts';
import { validWordle } from './wordle.ts';
import { validLudo, validSnakes } from './races.ts';
import { validCrazyEightsCheckpoint, validUnoCheckpoint } from './cards.ts';
import { validBlackjack } from './blackjack.ts';
import { isValidState } from './tictactoe.ts';
import type { LocalState } from './tictactoe.ts';
import { puzzleValidators, PUZZLE_IDS } from './puzzles.ts';
import type { PuzzleId } from './puzzles.ts';
export function validCheckpoint(id: string, state: unknown): boolean {
  if (id === 'pool') return validPool(state);
  if (id === 'air-hockey') return validHockey(state);
  if (id === 'business') return validBusiness(state);
  if (id === 'catan') return validCatanCheckpoint(state);
  if (id === 'imposter') return validImposter(state);
  if (id === 'dumb-charades') return validCharades(state);
  if (id === 'chess') return validChess(state);
  if (id === 'rps') return validRps(state);
  if (id === 'show-star') return validShow(state);
  if (id === 'taboo') return validTaboo(state);
  if (id === 'whack-a-mole') return validWhack(state);
  if (id === 'word-scramble') return validScramble(state);
  if (id === 'hangman') return validHangmanState(state);
  if (id === 'wordle') return validWordle(state);
  if (id === 'snakes-ladders') return validSnakes(state);
  if (id === 'ludo') return validLudo(state);
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
  'catan',
  'business',
  'mafia',
  'chess',
  'rps',
  'tictactoe',
  'connect-four',
  'crazy-eights',
  'uno',
  'snakes-ladders',
  'ludo',
]);
