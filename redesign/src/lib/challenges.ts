import {
  actStrands,
  newStrands,
  strandsDone,
  validStrands,
} from './strands.ts';
import type { StrandsState } from './strands.ts';
export const CHALLENGE_IDS = ['strands'] as const;
export type ChallengeId = (typeof CHALLENGE_IDS)[number];
export type ChallengeState = StrandsState;
export const isChallenge = (id: string): id is ChallengeId =>
  (CHALLENGE_IDS as readonly string[]).includes(id);
export function newChallenge(
  id: ChallengeId,
  mode = 'daily',
  players = 1,
): ChallengeState {
  void players;
  return newStrands(mode);
}
export function validChallenge(
  value: unknown,
  allowFinished = false,
): value is ChallengeState {
  return validStrands(value, allowFinished);
}
export function challengeDone(s: ChallengeState) {
  return strandsDone(s);
}
export function challengeWinners(s: ChallengeState, players: number): number[] {
  return challengeDone(s) ? Array.from({ length: players }, (_, i) => i) : [];
}
export function challengeTurn(s: ChallengeState): number | null {
  void s;
  return null;
}
export function actChallenge(s: ChallengeState, input: unknown) {
  return actStrands(s, input);
}
export const challengeHelp: Record<ChallengeId, string> = {
  strands:
    'Find all theme words and the spangram in the letter grid. Tap adjacent letters, including diagonals, then submit. You may not reuse a letter or cross a found word. The spangram joins opposite sides. Three hints can highlight the start of an unfound word. Play solo, together on one device, or cooperatively in a private room. Guesses and hints are shared; your letter selection stays local.',
};
