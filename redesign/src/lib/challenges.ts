import { object } from './daily.ts';
import {
  actStrands,
  newStrands,
  strandsDone,
  validStrands,
} from './strands.ts';
import type { StrandsState } from './strands.ts';
import { actBee, newBee, beeDone, validBee } from './bee.ts';
import type { BeeState } from './bee.ts';
import {
  actLetter,
  newLetter,
  letterDone,
  validLetter,
} from './letter-boxed.ts';
import type { LetterState } from './letter-boxed.ts';
import { actMini, newMini, miniDone, validMini } from './mini.ts';
import type { MiniState } from './mini.ts';
import { actTiles, newTiles, tilesDone, validTiles } from './tiles.ts';
import type { TilesState } from './tiles.ts';
import { actSudoku, newSudoku, sudokuDone, validSudoku } from './sudoku.ts';
import type { SudokuState } from './sudoku.ts';
import {
  actQuoridor,
  newQuoridor,
  quoridorDone,
  validQuoridor,
} from './quoridor.ts';
import type { QuoridorState } from './quoridor.ts';
export const CHALLENGE_IDS = [
  'strands',
  'spelling-bee',
  'letter-boxed',
  'mini-crossword',
  'tiles',
  'sudoku',
  'quoridor',
] as const;
export type ChallengeId = (typeof CHALLENGE_IDS)[number];
export type ChallengeState =
  | StrandsState
  | BeeState
  | LetterState
  | MiniState
  | TilesState
  | SudokuState
  | QuoridorState;
export const isChallenge = (id: string): id is ChallengeId =>
  (CHALLENGE_IDS as readonly string[]).includes(id);
export function newChallenge(
  id: ChallengeId,
  mode = 'daily',
  players = 1,
  difficulty = 'easy',
): ChallengeState {
  void players;
  void difficulty;
  switch (id) {
    case 'strands':
      return newStrands(mode);
    case 'spelling-bee':
      return newBee(mode);
    case 'letter-boxed':
      return newLetter(mode);
    case 'mini-crossword':
      return newMini(mode);
    case 'tiles':
      return newTiles(mode, players);
    case 'sudoku':
      return newSudoku(mode, difficulty);
    case 'quoridor':
      return newQuoridor();
  }
}
export function validChallenge(
  value: unknown,
  allowFinished = false,
): value is ChallengeState {
  if (!object(value)) return false;
  switch (value.gameId) {
    case 'strands':
      return validStrands(value, allowFinished);
    case 'spelling-bee':
      return validBee(value, allowFinished);
    case 'letter-boxed':
      return validLetter(value, allowFinished);
    case 'mini-crossword':
      return validMini(value, allowFinished);
    case 'tiles':
      return validTiles(value, allowFinished);
    case 'sudoku':
      return validSudoku(value, allowFinished);
    case 'quoridor':
      return validQuoridor(value, allowFinished);
    default:
      return false;
  }
}
export function challengeDone(s: ChallengeState) {
  switch (s.gameId) {
    case 'strands':
      return strandsDone(s);
    case 'spelling-bee':
      return beeDone(s);
    case 'letter-boxed':
      return letterDone(s);
    case 'mini-crossword':
      return miniDone(s);
    case 'tiles':
      return tilesDone(s);
    case 'sudoku':
      return sudokuDone(s);
    case 'quoridor':
      return quoridorDone(s);
  }
}
export function actChallenge(
  s: ChallengeState,
  input: unknown,
): { state: ChallengeState; message: string } {
  switch (s.gameId) {
    case 'strands':
      return actStrands(s, input);
    case 'spelling-bee':
      return actBee(s, input);
    case 'letter-boxed':
      return actLetter(s, input);
    case 'mini-crossword':
      return actMini(s, input);
    case 'tiles':
      return actTiles(s, input);
    case 'sudoku':
      return actSudoku(s, input);
    case 'quoridor':
      return actQuoridor(s, input);
  }
}
export function challengeWinners(s: ChallengeState, players: number): number[] {
  if (!challengeDone(s)) return [];
  if (s.gameId === 'quoridor') return s.winner === null ? [] : [s.winner];
  return Array.from({ length: players }, (_, i) => i);
}
export function challengeTurn(s: ChallengeState): number | null {
  if (s.gameId === 'quoridor') return s.current;
  if (s.gameId === 'tiles') return s.moves.length % s.players;
  void s;
  return null;
}
export function challengePlayers(s: ChallengeState): number | null {
  if (s.gameId === 'quoridor') return 2;
  if (s.gameId === 'tiles') return s.players;
  void s;
  return null;
}
export const challengeMax = (id: ChallengeId) => (id === 'quoridor' ? 2 : 20);
export const challengeHelp: Record<ChallengeId, string> = {
  strands:
    'Find all theme words and the spangram in the letter grid. Tap adjacent letters, including diagonals, then submit. You may not reuse a letter or cross a found word. The spangram joins opposite sides. Three hints highlight the start of unfound words. Play solo, together on one device, or cooperatively in a private room. Found words and hints are shared; your letter selection stays local.',
  'spelling-bee':
    'Make words of at least four letters using only the seven hive letters. Every word must include the golden center letter. Letters may repeat. Four-letter words score 1; longer words score their length. A pangram uses all seven letters and adds 7 points. The bundled practice dictionary is finite. Reach Genius at 70% of available points, then find every accepted word for Queen Bee. Room players share the hive, found words and team score; duplicate submissions do not score twice.',
  'letter-boxed':
    'Use at least three letters per word. Consecutive letters must come from different sides of the square. Your next word must start with the last letter of the previous word. Letters may be reused, but words may not repeat. Cover all twelve letters to win; try for two words. The bundled dictionary is finite. Undo removes the last word. Private-room players cooperate on one shared chain.',
  'mini-crossword':
    'Fill the 5\u00d75 grid using the Across and Down clues. Tap a clue to select its row or column; tap a cell again to switch direction. Type letters and use arrow keys to move. Check letters highlights incorrect entries without changing them. Reveal letter fills the selected cell and records assistance. Rooms share entries and revealed letters; the host accepts edits in revision order. These original Mini puzzles use word-square grids, so Across and Down answers intersect symmetrically.',
  tiles:
    'Select two different tiles sharing a ring, shape or background pattern. All matching layers disappear from both tiles. A tile clears when all three layers are gone. Reuse a remaining tile from your previous match to grow the combo; switching to a new pair starts a new combo. Clear every layer to win. Local multiplayer and private rooms take turns after each accepted match and share a team score. Invalid matches do not consume a turn.',
  sudoku:
    'Fill each row, column and 3\u00d73 box with digits 1\u20139 exactly once. Given and revealed cells are fixed. Select a cell and use the number pad or keyboard; arrow keys move, and Backspace clears. Pencil notes toggle candidates in empty cells. Reveal cell records assistance. Easy, medium and hard tiers use progressively fewer givens; each puzzle is checked for one unique solution. Room players share values and notes, and the host rejects stale edits.',
  quoridor:
    'Two players start at opposite edges with ten walls each. On your turn, move one square orthogonally or place a wall spanning two adjacent spaces. Jump an adjacent opponent if the square behind is open. If the straight jump is blocked by a wall or board edge, sidestep diagonally around that opponent. Walls cannot overlap, cross, or completely block either player\u2019s route. Reach any square on the opposite edge to win. In wall mode choose the upper-left anchor, inspect the preview, then confirm. Play pass-and-play or a two-player private room.',
};
