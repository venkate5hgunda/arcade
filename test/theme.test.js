import test from 'node:test';
import assert from 'node:assert/strict';

test('theme starts in Auto, follows the device, and cycles Light, Dark, Auto', async () => {
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  const oldStorage = globalThis.localStorage;
  const values = new Map();
  const listeners = new Map();
  const media = { matches: true, addEventListener: (type, fn) => listeners.set(type, fn) };
  const toggle = {
    dataset: {},
    setAttribute(key, value) { this[key] = value; },
    addEventListener(type, fn) { this[type] = fn; },
  };
  const modeLabel = { textContent: '' };
  const root = {
    style: {},
    setAttribute(key, value) { this[key] = value; },
    getAttribute(key) { return this[key]; },
  };
  const themeColor = { content: '' };
  const changes = [];
  try {
    globalThis.window = {
      matchMedia: () => media,
      dispatchEvent: event => changes.push(event.detail),
    };
    globalThis.document = {
      documentElement: root,
      getElementById: id => id === 'themeToggle' ? toggle : id === 'themeMode' ? modeLabel : themeColor,
    };
    globalThis.localStorage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    const { initTheme, currentTheme } = await import('../js/theme.js');
    initTheme();
    assert.equal(toggle.dataset.mode, 'auto');
    assert.equal(modeLabel.textContent, 'Auto');
    assert.match(toggle.title, /follows your device/);
    assert.equal(currentTheme(), 'dark');
    assert.equal(root.style.colorScheme, 'dark');
    assert.equal(themeColor.content, '#101222');
    media.matches = false;
    listeners.get('change')();
    assert.equal(currentTheme(), 'light');
    assert.equal(root.style.colorScheme, 'light');
    assert.equal(themeColor.content, '#efe9df');

    toggle.click();
    assert.equal(toggle.dataset.mode, 'light');
    assert.equal(values.get('arcade:ui.theme'), '"light"');
    media.matches = true;
    listeners.get('change')();
    assert.equal(currentTheme(), 'light', 'a chosen mode ignores OS changes');

    toggle.click();
    assert.equal(toggle.dataset.mode, 'dark');
    assert.equal(currentTheme(), 'dark');
    toggle.click();
    assert.equal(toggle.dataset.mode, 'auto');
    assert.equal(values.get('arcade:ui.theme'), '"auto"');
    assert.equal(currentTheme(), 'dark');
    assert.deepEqual(changes, ['dark', 'light', 'light', 'dark', 'dark']);
  } finally {
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
    globalThis.localStorage = oldStorage;
  }
});
