import test from 'node:test';
import assert from 'node:assert/strict';
import {
  diceMarkup, dieMarkup, pauseAfterRoll, rollDiceValues, ROLL_REVEAL_DELAY_MS,
} from '../js/dice.js';

test('shared roller produces one or two Pick-style d6 results from a supplied source', () => {
  assert.deepEqual(rollDiceValues(1, () => 0), [1]);
  assert.deepEqual(rollDiceValues(2, () => .999), [6, 6]);
  assert.throws(() => rollDiceValues(3), RangeError);
  assert.throws(() => rollDiceValues(2, () => 1), RangeError);
  assert.throws(() => diceMarkup([0, 3]), RangeError);
  assert.equal((diceMarkup([2, 4]).match(/class="arcade-die"/g) || []).length, 2);
  assert.equal((dieMarkup(5).match(/class="arcade-die"/g) || []).length, 1);
});

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
