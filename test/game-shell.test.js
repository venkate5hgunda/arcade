import test from 'node:test';
import assert from 'node:assert/strict';
import { createShell } from '../js/game-shell.js';
import { room } from '../js/multiplayer.js';

test('top reset control briefly confirms a local reset or room request', () => {
  const previous = {
    document: globalThis.document, setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout, activeGame: room.activeGame,
  };
  const timers = new Map();
  let nextTimer = 0;
  let setupActive = false;
  let resetClick;
  const button = {
    disabled: false,
    addEventListener(event, listener) { if (event === 'click') resetClick = listener; },
  };
  const toast = { hidden: false, setAttribute(name, value) { this[name] = value; } };
  const head = { appendChild(node) { assert.equal(node, toast); } };
  const shell = {
    style: { setProperty() {} },
    querySelector(selector) {
      if (selector === '[data-action="reset"]') return button;
      if (selector === '.game-head') return head;
      if (selector === '.setup-card') return setupActive ? {} : null;
      if (selector === '.game-stage') return {};
      return null;
    },
  };
  let created = 0;
  globalThis.document = { createElement() { return created++ ? toast : shell; } };
  globalThis.setTimeout = (callback, delay) => {
    const id = ++nextTimer;
    timers.set(id, { callback, delay });
    return id;
  };
  globalThis.clearTimeout = (id) => timers.delete(id);
  room.activeGame = null;

  try {
    createShell({ appendChild() {} }, { id: 'test-game', color: '#fff' });
    assert.equal(toast.hidden, true);
    assert.equal(toast.role, 'status');

    setupActive = true;
    resetClick();
    assert.equal(toast.hidden, true);
    setupActive = false;

    resetClick();
    assert.equal(toast.textContent, 'Game reset');
    assert.equal(toast.hidden, false);
    assert.equal(timers.size, 1);
    assert.equal([...timers.values()][0].delay, 2400);

    resetClick();
    assert.equal(timers.size, 1);
    timers.values().next().value.callback();
    assert.equal(toast.hidden, true);

    room.activeGame = { id: 'test-game' };
    resetClick();
    assert.equal(toast.textContent, 'Restart requested');
    button.disabled = true;
    resetClick();
    assert.equal(toast.textContent, 'Restart requested');
  } finally {
    globalThis.document = previous.document;
    globalThis.setTimeout = previous.setTimeout;
    globalThis.clearTimeout = previous.clearTimeout;
    room.activeGame = previous.activeGame;
  }
});
