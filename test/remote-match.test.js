import test from 'node:test';
import assert from 'node:assert/strict';
import { remoteMatch, seat, validTurn } from '../js/remote-match.js';

test('only admitted players in the active game receive a remote seat', () => {
  const activeGame = { id: 'ludo', playerIds: ['host', 'guest-1', 'guest-2'] };
  const room = { peerId: 'guest-2', activeGame };
  assert.equal(remoteMatch(room, 'ludo'), room);
  assert.equal(seat(room), 3);
  assert.equal(validTurn(room, 3, 'guest-2'), true);
  assert.equal(validTurn(room, 3, 'guest-1'), false);
  assert.equal(remoteMatch(room, 'chess'), null);
  assert.equal(remoteMatch({ ...room, peerId: 'spectator' }, 'ludo'), null);
});
