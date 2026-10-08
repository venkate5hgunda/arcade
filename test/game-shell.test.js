import test from 'node:test';
import assert from 'node:assert/strict';
import { createShell, renderSetup } from '../js/game-shell.js';
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

class SetupElement {
  constructor(tag = 'div') {
    this.tag = tag;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.parts = {};
  }
  set innerHTML(html) {
    this.html = html;
    this.children = [];
    this.parts = {};
    for (const name of ['setup-preview', 'setup-fields', 'setup-start-btn', 'setup-options']) {
      if (html.includes(`class="${name}"`)) this.parts[`.${name}`] = new SetupElement();
    }
  }
  querySelector(selector) {
    if (this.parts[selector]) return this.parts[selector];
    const key = selector.match(/data-setup-key="([^"]+)"/)?.[1];
    return this.children.find(child => child.dataset.setupKey === key)
      ?.querySelector('.setup-options').children.find(child => child.attributes['aria-pressed'] === 'true') ?? null;
  }
  appendChild(node) { this.children.push(node); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(event, listener) { this.listeners[event] = listener; }
  focus() { this.focused = true; }
  remove() { this.removed = true; }
}

test('setup collapses configuration, summarizes choices, and preserves customization on start', async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  try {
    globalThis.document = { createElement: tag => new SetupElement(tag) };
    globalThis.window = {};
    const stage = new SetupElement();
    const result = renderSetup(stage, {
      title: 'Ready to play',
      fields: [
        { key: 'players', label: 'Players', default: '4', help: 'Pass the device between turns.',
          options: [{ value: '3', label: '3 players' }, { value: '4', label: '4 players' }] },
        { key: 'style', label: 'Style', default: 'illustrated',
          options: [{ value: 'illustrated', label: 'Illustrated' }, { value: 'colorblock', label: 'Colorblock' }] },
      ],
    });
    const card = stage.children[0];
    assert.match(card.html, /<details class="setup-config">/);
    assert.doesNotMatch(card.html, /<details[^>]*\bopen\b/);
    assert.match(card.html, /Expand configuration to customize/);
    assert.equal(card.querySelector('.setup-preview').textContent, 'Players: 4 players · Style: Illustrated');
    const fields = card.querySelector('.setup-fields');
    assert.equal(fields.children[0].children.at(-1).textContent, 'Pass the device between turns.');
    const options = fields.children[0].querySelector('.setup-options').children;
    assert.equal(options[1].attributes['aria-pressed'], 'true');
    options[0].listeners.click();
    assert.equal(card.querySelector('.setup-preview').textContent, 'Players: 3 players · Style: Illustrated');
    assert.equal(fields.children[0].querySelector('.setup-options').children[0].focused, true,
      'keyboard focus follows the selected option after redraw');
    card.querySelector('.setup-start-btn').listeners.click();
    assert.deepEqual(await result, { players: '3', style: 'illustrated' });
    assert.equal(card.removed, true);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test('setup can start with unchanged defaults; acknowledgement-only games have no configuration', async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  try {
    globalThis.document = { createElement: tag => new SetupElement(tag) };
    globalThis.window = {};
    const stage = new SetupElement();
    const result = renderSetup(stage, {
      fields: Array.from({ length: 7 }, (_, i) => ({
        key: `rule${i}`, label: `Rule ${i}`, default: 'no',
        options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }],
      })),
    });
    const card = stage.children[0];
    assert.match(card.querySelector('.setup-preview').textContent, /4 more options in configuration/);
    assert.equal(card.querySelector('.setup-fields').children.length, 7);
    card.querySelector('.setup-start-btn').listeners.click();
    assert.deepEqual(await result, Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`rule${i}`, 'no'])));

    const readyStage = new SetupElement();
    const ready = renderSetup(readyStage, {
      fields: [{ key: 'ack', label: 'Ready?', options: [{ value: 'yes', label: 'Go' }] }],
    });
    const readyCard = readyStage.children[0];
    assert.doesNotMatch(readyCard.html, /setup-config|setup-preview/);
    readyCard.querySelector('.setup-start-btn').listeners.click();
    assert.deepEqual(await ready, { ack: 'yes' });
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test('numeric movie filters report empty selections and prevent starting until valid', async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  try {
    globalThis.document = { createElement: tag => new SetupElement(tag) };
    globalThis.window = {};
    const stage = new SetupElement();
    const result = renderSetup(stage, {
      fields: [{ key: 'year', label: 'From year', type: 'number', min: 1900, max: 2999, default: '1900' }],
      validate: values => Number(values.year) < 2000 ? 'No approved movies match.' : '',
      summary: () => 'Approved movie pool ready.',
    });
    const card = stage.children[0];
    const button = card.querySelector('.setup-start-btn');
    assert.equal(button.disabled, true);
    assert.equal(card.children.at(-1).textContent, 'No approved movies match.');
    button.listeners.click();
    assert.ok(!card.removed);
    const input = card.querySelector('.setup-fields').children[0].querySelector('.setup-options').children[0];
    input.value = '2000';
    input.listeners.input();
    assert.equal(button.disabled, false);
    assert.equal(card.children.at(-1).textContent, 'Approved movie pool ready.');
    button.listeners.click();
    assert.deepEqual(await result, { year: '2000' });
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});
