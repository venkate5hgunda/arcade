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
    { mode: 'daily' },
    (value) => validChallenge(value) && value.gameId === id,
    (settings) => newChallenge(id, settings.mode),
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
      ]}
      summary="A fresh challenge for your shelf. Play solo or solve it together."
      help={challengeHelp[id]}
      title={done ? 'Puzzle complete!' : 'Find the hidden theme'}
      status={
        done
          ? 'Every word is connected. Nicely done.'
          : 'Find the theme words and the spangram.'
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
            onClick={() => run.commit(newChallenge(id, 'practice'))}
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
