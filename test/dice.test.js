import test from 'node:test';
import assert from 'node:assert/strict';
import { pauseAfterRoll, ROLL_REVEAL_DELAY_MS } from '../js/dice.js';

test('die result stays visible before an automatic move can continue', async () => {
  const original = globalThis.setTimeout;
  let finish, delay;
  globalThis.setTimeout = (callback, duration) => {
    finish = callback;
    delay = duration;
    return 1;
  };
  try {
    const signal = new AbortController().signal;
    let completed = false;
    const pending = pauseAfterRoll(signal).then((result) => {
      completed = true;
      return result;
    });
    await Promise.resolve();
    assert.equal(completed, false);
    assert.ok(delay >= 240 + 500, 'the die must settle and remain readable');
    assert.equal(delay, ROLL_REVEAL_DELAY_MS);
    finish();
    assert.equal(await pending, true);
  } finally {
    globalThis.setTimeout = original;
  }
});

test('reset or navigation cancels the pending automatic move', async () => {
  const originalTimeout = globalThis.setTimeout;
  const originalClear = globalThis.clearTimeout;
  let timer, cleared = false;
  globalThis.setTimeout = (callback) => {
    timer = callback;
    return 1;
  };
  globalThis.clearTimeout = (id) => {
    assert.equal(id, 1);
    cleared = true;
  };
  try {
    const controller = new AbortController();
    const pending = pauseAfterRoll(controller.signal);
    controller.abort();
    assert.equal(await pending, false);
    assert.equal(cleared, true);
    assert.equal(await pauseAfterRoll(controller.signal), false);
    timer();
  } finally {
    globalThis.setTimeout = originalTimeout;
    globalThis.clearTimeout = originalClear;
  }
});
