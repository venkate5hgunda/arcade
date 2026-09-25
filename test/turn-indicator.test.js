import test from 'node:test';
import assert from 'node:assert/strict';
import { createTurnIndicator } from '../js/turn-indicator.js';

test('room turns name the active player and alert only on a newly acquired turn', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const names = ['Maya', 'Ravi'];
  const calls = [];
  const banner = {
    hidden: false,
    classes: new Set(),
    setAttribute() {},
    classList: { toggle(name, enabled) {
      if (enabled) banner.classes.add(name);
      else banner.classes.delete(name);
    } },
  };
  try {
    globalThis.document = { createElement: () => banner };
    globalThis.window = {
      arcadeAudio: { chime: () => calls.push('sound') },
      haptics: { select: () => calls.push('haptic') },
    };
    const root = { querySelector: () => ({ after(node) { assert.equal(node, banner); } }) };
    const match = {
      peerId: 'guest', activeGame: { playerIds: ['host', 'guest'] },
      members: ['host', 'guest'].map((id, i) => ({ id, name: names[i] })),
    };
    const showTurn = createTurnIndicator(root, match);
    showTurn(0);
    assert.match(banner.textContent, /Maya's turn · Waiting/);
    assert.equal(banner.classes.has('arcade-turn--mine'), false);
    showTurn(1);
    assert.equal(banner.textContent, 'Your turn · Ravi');
    assert.deepEqual(calls, ['sound', 'haptic']);
    showTurn(1);
    assert.equal(calls.length, 2, 're-rendering a turn does not replay the cue');
    showTurn(1, false);
    assert.equal(banner.hidden, true);
    const local = createTurnIndicator(root);
    local(0, true, 'Team 1 · Maya');
    assert.equal(banner.textContent, "Team 1 · Maya's turn");
    local(1, true, 'Team 2 · Ravi');
    assert.deepEqual(calls, ['sound', 'haptic', 'sound', 'haptic']);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});
