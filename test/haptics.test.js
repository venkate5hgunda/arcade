import test from 'node:test';
import assert from 'node:assert/strict';

test('native vibration works when offered and respects the toggle', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const calls = [];
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true, value: { userAgent: 'Android', vibrate: pattern => calls.push(pattern) },
  });
  try {
    const { isSupported, hasGameVibration, isEnabled, setEnabled, vibrate } =
      await import('../js/haptics.js?android');
    assert.equal(isSupported(), true);
    assert.equal(hasGameVibration(), true);
    assert.equal(isEnabled(), true);
    vibrate('success');
    assert.deepEqual(calls, [[30, 40, 50]]);
    setEnabled(false);
    vibrate('light');
    assert.equal(calls.length, 1);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'navigator', previous);
    else delete globalThis.navigator;
  }
});

test('iOS native switch is offered without claiming unsupported game vibrations', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true, value: { userAgent: 'iPhone', maxTouchPoints: 5 },
  });
  try {
    const { isSupported, hasGameVibration, vibrate } = await import('../js/haptics.js?ios');
    assert.equal(isSupported(), true);
    assert.equal(hasGameVibration(), false);
    assert.doesNotThrow(() => vibrate('success'));
  } finally {
    if (previous) Object.defineProperty(globalThis, 'navigator', previous);
    else delete globalThis.navigator;
  }
});
