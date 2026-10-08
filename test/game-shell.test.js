import test from 'node:test';
import assert from 'node:assert/strict';
import { clockField, createShell, renderSetup } from '../js/game-shell.js';
import { createSpring, detent } from '../js/motion.js';
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
    this.style = { setProperty() {} };
    this.classList = { add() {}, remove() {}, toggle() {} };
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
  getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 100 }; }
  setPointerCapture() {}
  releasePointerCapture() {}
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
    const input = fields.children[0].querySelector('.setup-options').children[1].children[0];
    assert.equal(input.value, '1');
    assert.equal(input.attributes['aria-valuetext'], '4 players');
    input.value = '0';
    input.listeners.input();
    assert.equal(card.querySelector('.setup-preview').textContent, 'Players: 3 players · Style: Illustrated');
    assert.equal(fields.children[0].querySelector('.setup-options').children[1].children[0], input,
      'slider input updates without replacing the focused control');
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

test('range handles cannot cross and multiple levels toggle without losing other selections', async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  try {
    globalThis.document = { createElement: tag => new SetupElement(tag) };
    globalThis.window = {};
    const stage = new SetupElement();
    const result = renderSetup(stage, {
      fields: [
        { key: 'years', label: 'Movie years', type: 'range', min: 1931, max: 2026, default: [2000, 2026] },
        { key: 'levels', label: 'Difficulty', type: 'multiple', default: ['1', '2'],
          options: [{ value: '1', label: 'Easy', badge: '1' }, { value: '2', label: 'Approachable', badge: '2' }] },
      ],
    });
    const card = stage.children[0];
    const fields = card.querySelector('.setup-fields');
    const range = fields.children[0].querySelector('.setup-options');
    const [lower, upper] = range.children[1].children;
    upper.value = '1990';
    upper.listeners.input();
    assert.equal(upper.value, '2000');
    assert.equal(range.children[0].textContent, '2000 – 2000');
    lower.value = '1980';
    lower.listeners.input();
    assert.equal(lower.value, '1980');
    assert.equal(upper.attributes['aria-valuemin'], '1980');
    const levels = fields.children[1].querySelector('.setup-options').children;
    levels[0].listeners.click();
    assert.equal(levels[0].attributes['aria-pressed'], 'false');
    assert.equal(levels[1].attributes['aria-pressed'], 'true');
    assert.match(card.querySelector('.setup-preview').textContent, /1980–2000.*Approachable/);
    card.querySelector('.setup-start-btn').listeners.click();
    assert.deepEqual(await result, { years: [1980, 2000], levels: ['2'] });
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test('clock dial selects any time, resists gently at quarter marks and reverses at limits', async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  try {
    globalThis.document = { createElement: tag => new SetupElement(tag) };
    let clicks = 0;
    globalThis.window = { haptics: { select() { clicks++; }, medium() {} } };
    const stage = new SetupElement();
    const result = renderSetup(stage, {
      fields: [{ key: 'timer', label: 'Turn timer', type: 'clock', step: 30, stepDegrees: 90, maxTurns: 3, min: 10, default: '30' }],
    });
    const card = stage.children[0];
    const clock = card.querySelector('.setup-fields').children[0].querySelector('.setup-options').children[0];
    const at = degrees => {
      const radians = degrees * Math.PI / 180;
      return { pointerId: 1, button: 0, clientX: 50 + 40 * Math.sin(radians), clientY: 50 - 40 * Math.cos(radians), preventDefault() {} };
    };
    const value = () => Number(clock.attributes['aria-valuenow']);
    const readout = clock.children.flatMap(child => [child, ...child.children]).find(child => child.tag === 'output');

    clock.listeners.pointerdown(at(90));
    clock.listeners.pointermove(at(127));
    assert.equal(value(), 42, 'free values between quarter marks (37 degrees = 12 seconds)');
    clock.listeners.pointermove(at(178));
    assert.ok(value() > 59 && value() < 60.5, 'approaching a mark is pulled toward it');
    clock.listeners.pointermove(at(188));
    assert.equal(value(), 62, 'detent is sticky but can be pushed through');
    clock.listeners.pointermove(at(197));
    assert.equal(value(), 66);
    clock.listeners.pointerup(at(197));
    assert.equal(value(), 66, 'released away from a mark keeps the exact chosen time');
    assert.equal(readout.textContent, '1:06');
    assert.ok(clicks >= 1, 'crossing a quarter mark gives a detent tick');

    clock.listeners.pointerdown(at(197));
    clock.listeners.pointermove(at(182));
    clock.listeners.pointerup(at(182));
    assert.equal(value(), 60, 'released within the detent settles onto the mark');

    clock.listeners.pointerdown(at(180));
    for (let angle = 225; angle <= 180 + 1440; angle += 45) clock.listeners.pointermove(at(angle));
    assert.equal(value(), 360, 'clamped to three turns');
    clock.listeners.pointermove(at(135));
    assert.ok(value() < 360, 'reversing after the maximum removes time immediately');
    clock.listeners.pointercancel();

    clock.listeners.keydown({ key: 'Home', preventDefault() {} });
    assert.equal(value(), 10);
    clock.listeners.keydown({ key: 'PageUp', preventDefault() {} });
    clock.listeners.keydown({ key: 'ArrowRight', preventDefault() {} });
    assert.equal(value(), 45);
    assert.match(card.querySelector('.setup-preview').textContent, /Turn timer: 0:45/);
    card.querySelector('.setup-start-btn').listeners.click();
    assert.deepEqual(await result, { timer: '45' });
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test('clock dial step size, minimum and maximum turns are configurable per game', () => {
  const field = clockField({ key: 'rounds', label: 'Rounds', type: 'clock', step: 1, stepDegrees: 30, maxTurns: 2, unit: '', default: '99' });
  assert.equal(field.min, 1);
  assert.equal(field.max, 24);
  assert.equal(field.default, '24', 'out-of-range defaults are clamped');
  assert.equal(clockField({ step: 30 }).max, 360, 'defaults to 90-degree steps and three turns');
  assert.equal(clockField({ step: 30, maxTurns: 1, default: '47' }).default, '47');
  assert.throws(() => clockField({ stepDegrees: 70 }), /divide 360/);
});

test('springs settle with momentum and detents soften motion near marks', () => {
  const frames = [];
  const previous = { raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame };
  let now = 0;
  globalThis.requestAnimationFrame = callback => frames.push(callback);
  globalThis.cancelAnimationFrame = () => {};
  try {
    const seen = [];
    let rested = false;
    const spring = createSpring(value => seen.push(value));
    spring.jump(0);
    spring.to(100, { stiffness: 170, damping: 19, onRest: () => { rested = true; } });
    while (frames.length && now < 5000) { now += 16; frames.shift()(now); }
    assert.ok(rested);
    assert.equal(seen.at(-1), 100);
    assert.ok(Math.max(...seen) > 100, 'slightly underdamped settle has a soft overshoot');
    assert.ok(seen.length > 10, 'animated over multiple frames');
  } finally {
    globalThis.requestAnimationFrame = previous.raf;
    globalThis.cancelAnimationFrame = previous.caf;
  }
  assert.equal(detent(95, 90, 10), 90 + 10 * 0.5 ** 3);
  assert.equal(detent(120, 90, 10), 120);
  assert.equal(detent(37, 90, 0), 37);
});

test('compact numeric sliders and categorical dropdowns keep each game allowed choices', async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  try {
    globalThis.document = { createElement: tag => new SetupElement(tag) };
    globalThis.window = {};
    const stage = new SetupElement();
    const result = renderSetup(stage, {
      fields: [
        { key: 'target', label: 'Winning score', default: '7',
          options: [5, 7, 10].map(value => ({ value: String(value), label: `First to ${value}` })) },
        { key: 'speed', label: 'Speed', default: 'normal',
          options: ['slow', 'normal', 'fast'].map(value => ({ value, label: value })) },
      ],
    });
    const card = stage.children[0], fields = card.querySelector('.setup-fields');
    const slider = fields.children[0].querySelector('.setup-options').children[1].children[0];
    slider.value = '2'; slider.listeners.input();
    const select = fields.children[1].querySelector('.setup-options').children[0];
    assert.equal(select.tag, 'select');
    select.value = 'fast'; select.listeners.change();
    card.querySelector('.setup-start-btn').listeners.click();
    assert.deepEqual(await result, { target: '10', speed: 'fast' });
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});
