import { Link } from 'react-router-dom';
import { Frame, useRun } from '../components/GameFrame.tsx';
import { ConnectionsTable } from '../components/ConnectionsTable.tsx';
import {
  CONNECTIONS_HELP,
  connectionsProgress,
  newConnections,
  submitConnections,
  validConnections,
} from '../lib/connections.ts';
import type { ConnectionsState } from '../lib/connections.ts';

export function ConnectionsGame() {
  const run = useRun<ConnectionsState>(
    'connections',
    { mode: 'daily' },
    validConnections,
    (settings) => newConnections(settings.mode),
    (state) => connectionsProgress(state).over,
  );
  const game = run.state;
  const progress = game && connectionsProgress(game);
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
      summary="Sixteen words. Four hidden connections. Find the threads that tie them together."
      setupSummary="Solo or solve together on one screen · 24 original offline puzzles"
      setupExtra={
        <Link className="room-callout" to="/room?game=connections">
          Solve together in a private room →
        </Link>
      }
      help={CONNECTIONS_HELP}
      title={
        progress?.over
          ? progress.won
            ? 'All connections found!'
            : 'Out of mistakes'
          : `${4 - (progress?.solved.length ?? 0)} groups to find`
      }
      status={
        progress?.over
          ? progress.won
            ? 'A beautifully connected board.'
            : 'Every group is revealed below. Try a practice puzzle next.'
          : 'Find four groups of four. You can make four mistakes.'
      }
      after={
        progress?.over && (
          <button
            className="primary"
            onClick={() => {
              run.commit(newConnections('practice'));
            }}
          >
            New practice puzzle
          </button>
        )
      }
    >
      {game && (
        <ConnectionsTable
          game={game}
          blocked={run.saving}
          submit={(words) => {
            const result = submitConnections(game, words);
            if (result.state !== game) run.commit(result.state);
          }}
        />
      )}
    </Frame>
  );
}
