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
export const CHALLENGE_IDS = ['strands', 'spelling-bee'] as const;
export type ChallengeId = (typeof CHALLENGE_IDS)[number];
export type ChallengeState = StrandsState | BeeState;
export const isChallenge = (id: string): id is ChallengeId =>
  (CHALLENGE_IDS as readonly string[]).includes(id);
export function newChallenge(
  id: ChallengeId,
  mode = 'daily',
  players = 1,
): ChallengeState {
  void players;
  switch (id) {
    case 'strands':
      return newStrands(mode);
    case 'spelling-bee':
      return newBee(mode);
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
  }
}
export function challengeWinners(s: ChallengeState, players: number): number[] {
  if (!challengeDone(s)) return [];
  return Array.from({ length: players }, (_, i) => i);
}
export function challengeTurn(s: ChallengeState): number | null {
  void s;
  return null;
}
export function challengePlayers(s: ChallengeState): number | null {
  void s;
  return null;
}
export const challengeMax = (id: ChallengeId) =>
  id === ('' as string) ? 2 : 20;
export const challengeHelp: Record<ChallengeId, string> = {
  strands:
    'Find all theme words and the spangram in the letter grid. Tap adjacent letters, including diagonals, then submit. You may not reuse a letter or cross a found word. The spangram joins opposite sides. Three hints highlight the start of unfound words. Play solo, together on one device, or cooperatively in a private room. Found words and hints are shared; your letter selection stays local.',
  'spelling-bee':
    'Make words of at least four letters using only the seven hive letters. Every word must include the golden center letter. Letters may repeat. Four-letter words score 1; longer words score their length. A pangram uses all seven letters and adds 7 points. The bundled practice dictionary is finite. Reach Genius at 70% of available points, then find every accepted word for Queen Bee. Room players share the hive, found words and team score; duplicate submissions do not score twice.',
};
