import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOM_GAMES,
  recordStanding,
  validStandings,
  leaderboard,
} from '../../src/lib/room/standings.ts';
import type { Standings } from '../../src/lib/room/standings.ts';
test('all room games accumulate wins/losses/draws, share team wins and ignore duplicate round results', () => {
  const ids = ['mira', 'kai', 'rae'];
  let stats: Standings = { players: [], recorded: [] };
  for (const [round, game] of ROOM_GAMES.entries()) {
    const winners = game === 'mafia' || game === 'business' ? [0, 2] : [0];
    const next = recordStanding(stats, ids, game, round, winners);
    assert.equal(recordStanding(next, ids, game, round, null), next);
    assert.deepEqual(stats.recorded, round ? [round - 1] : []);
    stats = next;
  }
  assert.ok(validStandings(stats, ids));
  stats = recordStanding(stats, ids, 'tictactoe', ROOM_GAMES.length, null);
  const leaders = leaderboard(
    stats,
    ids.map((id) => ({ id, name: id })),
  );
  assert.deepEqual(
    leaders.map((p) => p.id),
    ['mira', 'rae', 'kai'],
  );
  assert.equal(leaders[0].wins, 11);
  assert.equal(leaders[2].losses, 11);
  assert.equal(leaders[0].draws, 1);
  assert.equal(
    leaderboard(
      stats,
      ids.map((id) => ({ id, name: id })),
      'mafia',
    )[1].wins,
    1,
  );
  const invalid = structuredClone(stats);
  invalid.players[0].wins++;
  assert.equal(validStandings(invalid, ids), false);
  invalid.players[0].id = 'stranger';
  assert.equal(validStandings(invalid, ids), false);
});
