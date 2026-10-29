import { useState } from 'react';
import { GAMES } from '../lib/games.ts';
import { leaderboard, ROOM_GAMES } from '../lib/room/standings.ts';
import type { RoomGame, Standings } from '../lib/room/standings.ts';
export function RoomStandings({
  standings,
  members,
}: {
  standings: Standings;
  members: { id: string; name: string }[];
}) {
  const [game, setGame] = useState<RoomGame | ''>('');
  const played = ROOM_GAMES.filter((id) =>
    standings.players.some((p) => p.games[id]),
  );
  const leaders = leaderboard(standings, members, game || undefined);
  return (
    <details className="help-card room-standings">
      <summary>Room standings</summary>
      <p>
        Ranked by wins, then fewer losses, more draws and name. Results stay
        with this room across replays.
      </p>
      {!standings.players.length ? (
        <p>No results yet. Finish a game to start the leaderboard.</p>
      ) : (
        <>
          <label>
            Standings game
            <select
              value={game}
              onChange={(e) => setGame(e.target.value as RoomGame | '')}
            >
              <option value="">All games</option>
              {played.map((id) => (
                <option key={id} value={id}>
                  {GAMES.find((g) => g.id === id)!.name}
                </option>
              ))}
            </select>
          </label>
          <ol aria-label="Room leaderboard">
            {leaders.map((player) => (
              <li key={player.id}>
                <strong>{player.name}</strong> · {player.wins} W /{' '}
                {player.losses} L / {player.draws} D
              </li>
            ))}
          </ol>
        </>
      )}
    </details>
  );
}
