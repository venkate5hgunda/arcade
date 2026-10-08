import test from 'node:test';
import assert from 'node:assert/strict';
import imposter, { validCheckpoint, setupError, maxImposters, drawWord } from '../games/imposter.js';
import { IMPOSTER_CATEGORIES, WORD_CATEGORY_IDS } from '../js/imposter-words.js';
import { TELUGU_MOVIES } from '../js/party-prompts.js';

const food = IMPOSTER_CATEGORIES.find(category => category.id === 'food');
const entry = food.words[0];
const base = {
  players: 6, mode: 'classic', intel: ['category', 'hint', 'team'], imposterRange: [2, 2],
  categories: ['food'], category: 'food', word: entry.word, hint: entry.hint, decoy: entry.decoy,
  phase: 'setup', currentPlayer: 0, round: 1, starter: 0, imposters: [1, 4], out: [], history: [],
  votes: Array(6).fill(null),
};

test('word catalog is large, unique per category and has decoys and hints', () => {
  assert.ok(IMPOSTER_CATEGORIES.length >= 20);
  assert.deepEqual(WORD_CATEGORY_IDS, IMPOSTER_CATEGORIES.map(category => category.id));
  const total = IMPOSTER_CATEGORIES.reduce((sum, category) => sum + category.words.length, 0);
  assert.ok(total >= 600);
  for (const category of IMPOSTER_CATEGORIES) {
    assert.ok(category.label && category.emoji);
    assert.equal(new Set(category.words.map(word => word.word)).size, category.words.length, category.id);
    for (const word of category.words) {
      assert.ok(word.word && word.hint && word.decoy, `${category.id}:${word.word}`);
      assert.notEqual(word.word, word.decoy);
      assert.ok(!word.hint.toLowerCase().includes(word.word.toLowerCase()), word.word);
    }
  }
});

test('imposter limits and setup validation', () => {
  assert.equal(maxImposters(3), 1);
  assert.equal(maxImposters(4), 1);
  assert.equal(maxImposters(5), 2);
  assert.equal(maxImposters(20), 6);
  const values = { players: '4', mode: 'classic', imposterRange: [1, 2], categories: ['food'] };
  assert.equal(setupError([], values), 'With 4 players, use at most 1 imposter.');
  assert.equal(setupError([], { ...values, imposterRange: [1, 1] }), '');
  assert.equal(setupError([], { ...values, imposterRange: [1, 1], categories: [] }), 'Pick at least one word category.');
  assert.equal(setupError(TELUGU_MOVIES, { ...values, imposterRange: [1, 1], categories: ['telugu-movies'] }), '');
});

test('drawWord picks from selected categories and gives movie decoys', () => {
  for (let i = 0; i < 30; i++) {
    const draw = drawWord(['food', 'animals'], []);
    assert.ok(['food', 'animals'].includes(draw.category));
    assert.ok(draw.decoy && draw.decoy !== draw.word);
  }
  const movie = drawWord(['telugu-movies'], TELUGU_MOVIES);
  assert.equal(movie.category, 'telugu-movies');
  assert.ok(movie.decoy && movie.decoy !== movie.word);
});

test('checkpoints validate multi-imposter state and reject impossible ones', () => {
  assert.ok(validCheckpoint(base));
  assert.ok(validCheckpoint({ ...base, mode: 'pair', intel: [] }));
  assert.ok(!validCheckpoint({ ...base, players: 21, votes: Array(21).fill(null) }));
  assert.ok(validCheckpoint({ ...base, players: 20, imposters: [0, 3, 9, 12, 15, 19], votes: Array(20).fill(null) }));
  assert.ok(!validCheckpoint({ ...base, imposters: [1, 2, 4] }), 'too many imposters for 6 players');
  assert.ok(!validCheckpoint({ ...base, hint: 'made up' }));
  assert.ok(!validCheckpoint({ ...base, mode: 'pair', decoy: '' }));
  assert.ok(!validCheckpoint({ ...base, category: 'animals' }));
  assert.ok(!validCheckpoint({ ...base, phase: 'discuss', out: [1, 4] }), 'finished game cannot resume');
  assert.ok(validCheckpoint({ ...base, phase: 'discuss', out: [1], currentPlayer: 0, history: [{ round: 1, out: 1 }], round: 2 }));
  assert.ok(!validCheckpoint({ ...base, phase: 'vote', out: [1], currentPlayer: 1 }), 'eliminated player cannot vote');
  assert.ok(!validCheckpoint({ ...base, phase: 'vote', out: [1], votes: [1, null, null, null, null, null] }), 'cannot vote for eliminated');
});

function withDOM() {
  const previous = { document: globalThis.document, window: globalThis.window, localStorage: globalThis.localStorage, Element: globalThis.Element };
  const listeners = new Map();
  const makeElement = () => {
    const handlers = new Map();
    return {
      children: [], handlers, style: { setProperty() {} }, classList: { add() {}, toggle() {} }, innerHTML: '', textContent: '',
      appendChild(child) { this.children.push(child); }, after() {}, setAttribute() {}, remove() {},
      addEventListener(event, handler) { handlers.set(event, handler); },
      querySelector(selector) {
        if (!this.controls) this.controls = new Map();
        if (!this.controls.has(selector)) this.controls.set(selector, makeElement());
        return this.controls.get(selector);
      },
      querySelectorAll(selector) {
        if (selector !== '.imp-vote-btn') return [];
        this.voteButtons ??= Array.from({ length: 6 }, (_, index) => {
          const button = makeElement();
          button.dataset = { vote: String(index) };
          return button;
        });
        return this.voteButtons;
      },
    };
  };
  globalThis.document = { hidden: false, createElement: makeElement, addEventListener(e, h) { listeners.set(e, h); }, removeEventListener() {} };
  globalThis.window = { addEventListener() {}, removeEventListener() {}, setTimeout() {} };
  globalThis.localStorage = { getItem() { return null; }, setItem() {} };
  globalThis.Element = Object;
  return { makeElement, restore() { Object.assign(globalThis, previous); } };
}

async function play(state) {
  const dom = withDOM();
  let finished = 0;
  const session = { get state() { return state; }, save(next) { state = next; }, finish() { finished++; } };
  const container = dom.makeElement();
  const game = await imposter.render(container, { color: '#fff' }, { session, movieLibrary: TELUGU_MOVIES });
  const card = container.children[0].querySelector('.game-stage').children[0];
  const vote = target => {
    card.querySelectorAll('.imp-vote-btn')[target].handlers.get('click')();
    card.querySelector('#submitVote').handlers.get('click')();
  };
  return { card, vote, get state() { return state; }, get finished() { return finished; }, done() { game.dispose(); dom.restore(); } };
}

test('reveal respects imposter intel and pair mode hides roles', async () => {
  const hidden = await play({ ...base, intel: ['team'], currentPlayer: 1 });
  try {
    hidden.card.querySelector('#showCard').handlers.get('click')();
    assert.ok(hidden.card.innerHTML.includes('imposter'));
    assert.ok(!hidden.card.innerHTML.includes(entry.hint));
    assert.ok(!hidden.card.innerHTML.includes('Food'));
    assert.ok(hidden.card.innerHTML.includes('Player 5') || hidden.card.innerHTML.includes('With'));
  } finally { hidden.done(); }

  const full = await play({ ...base, intel: ['category', 'hint'], currentPlayer: 1 });
  try {
    full.card.querySelector('#showCard').handlers.get('click')();
    assert.ok(full.card.innerHTML.includes(entry.hint));
    assert.ok(!full.card.innerHTML.includes('With '));
  } finally { full.done(); }

  const pair = await play({ ...base, mode: 'pair', intel: [], currentPlayer: 1 });
  try {
    pair.card.querySelector('#showCard').handlers.get('click')();
    assert.ok(pair.card.innerHTML.includes(entry.decoy));
    assert.ok(!pair.card.innerHTML.includes('imposter'));
    assert.ok(!pair.card.innerHTML.includes(`<strong>${entry.word}</strong>`));
  } finally { pair.done(); }
});

test('multi-round voting eliminates, ties spare everyone, and town wins when all imposters are out', async () => {
  const game = await play({ ...base, phase: 'vote', currentPlayer: 5, votes: [1, 0, 1, 1, 0, null] });
  try {
    game.vote(1);
    assert.equal(game.state.phase, 'verdict');
    assert.deepEqual(game.state.out, [1]);
    assert.equal(game.finished, 0);
    assert.ok(game.card.innerHTML.includes('was an imposter'));
    game.card.querySelector('#nextRound').handlers.get('click')();
    assert.equal(game.state.phase, 'discuss');
    game.card.querySelector('#startVote').handlers.get('click')();
    assert.equal(game.state.currentPlayer, 0);
    for (const voter of [0, 2, 3, 4, 5]) {
      assert.equal(game.state.currentPlayer, voter);
      game.vote(voter === 4 ? 0 : 4);
    }
    assert.equal(game.finished, 1);
    assert.ok(game.card.innerHTML.includes('caught every imposter'));
  } finally { game.done(); }
});

test('imposters win when they match the remaining crew', async () => {
  const state = { ...base, players: 5, imposters: [1, 4], phase: 'vote', currentPlayer: 4,
    votes: [2, 2, 1, 2, null], imposterRange: [1, 2] };
  const game = await play(state);
  try {
    game.vote(2);
    assert.equal(game.finished, 1);
    assert.ok(game.card.innerHTML.includes('imposters win'));
  } finally { game.done(); }
});
