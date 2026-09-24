import test from 'node:test';
import assert from 'node:assert/strict';
import { playerName, savePlayerNames } from '../js/player-names.js';

test('local seat names persist while room seats use the roster', () => {
  const old = globalThis.localStorage;
  const storage = new Map();
  globalThis.localStorage = {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, value); },
  };
  try {
    assert.equal(playerName(0), 'Player 1');
    savePlayerNames(['  Ari  ', ' Mei ']);
    assert.equal(playerName(0), 'Ari');
    assert.equal(playerName(1), 'Mei');
    assert.equal(playerName(2), 'Player 3');
    const room = { activeGame: { playerIds: ['host', 'guest'] },
      members: [{ id: 'host', name: 'Ravi' }, { id: 'guest', name: 'Lila' }] };
    assert.equal(playerName(0, room), 'Ravi');
    assert.equal(playerName(1, room), 'Lila');
    assert.throws(() => savePlayerNames(['x'.repeat(25)]), /24 characters/);
    assert.throws(() => playerName(8), RangeError);
  } finally { globalThis.localStorage = old; }
});
