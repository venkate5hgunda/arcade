import { getGame } from '../lib/games.ts';
import { Link } from 'react-router-dom';
import { Frame, useRun } from '../components/GameFrame.tsx';
import { ChallengeTable } from '../components/ChallengeTable.tsx';
import {
  actChallenge,
  challengeDone,
  challengeHelp,
  newChallenge,
  validChallenge,
} from '../lib/challenges.ts';
import type { ChallengeId, ChallengeState } from '../lib/challenges.ts';
export function ChallengeGame({ id }: { id: ChallengeId }) {
  const run = useRun<ChallengeState>(
    id,
    { mode: 'daily', players: '1', difficulty: 'easy' },
    (value) => validChallenge(value) && value.gameId === id,
    (settings) =>
      newChallenge(
        id,
        settings.mode,
        Number(settings.players),
        settings.difficulty,
      ),
    challengeDone,
  );
  const state = run.state,
    done = !!state && challengeDone(state);
  return (
    <Frame
      run={run}
      fields={[
        {
          key: 'mode',
          label: 'Puzzle',
          options: [
            ['daily', 'Daily puzzle'],
            ['practice', 'Practice puzzle'],
          ],
        },
        ...(id === 'tiles'
          ? [
              {
                key: 'players',
                label: 'Players on this device',
                options: [
                  ['1', 'Solo'],
                  ['2', '2 players'],
                  ['3', '3 players'],
                  ['4', '4 players'],
                ] as [string, string][],
              },
            ]
          : []),
        ...(id === 'sudoku'
          ? [
              {
                key: 'difficulty',
                label: 'Difficulty',
                options: [
                  ['easy', 'Easy'],
                  ['medium', 'Medium'],
                  ['hard', 'Hard'],
                ] as [string, string][],
              },
            ]
          : []),
      ]}
      summary={getGame(id)!.description}
      help={challengeHelp[id]}
      title={done ? 'Puzzle complete!' : getGame(id)!.name}
      status={
        done
          ? 'A completed puzzle. Nicely done.'
          : 'Play at your pace. Your progress is saved on this device.'
      }
      setupExtra={
        <Link className="room-callout" to={`/room?game=${id}`}>
          Play together in a private room →
        </Link>
      }
      after={
        done && (
          <button
            className="primary"
            onClick={() =>
              run.commit(
                newChallenge(
                  id,
                  'practice',
                  run.state && 'players' in run.state
                    ? run.state.players
                    : Number(run.settings.players),
                  run.state?.gameId === 'sudoku'
                    ? run.state.difficulty
                    : run.settings.difficulty,
                ),
              )
            }
          >
            New practice puzzle
          </button>
        )
      }
    >
      {state && (
        <ChallengeTable
          state={state}
          blocked={run.saving}
          act={(input) => {
            const next = actChallenge(state, input).state;
            if (next !== state) run.commit(next);
          }}
        />
      )}
    </Frame>
  );
}
