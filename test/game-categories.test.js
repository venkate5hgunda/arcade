import test from 'node:test';
import assert from 'node:assert/strict';
import charades, { validCheckpoint as validCharades } from '../games/dumb-charades.js';
import imposter, { validCheckpoint as validImposter } from '../games/imposter.js';
import { TELUGU_MOVIES } from '../js/party-prompts.js';

const movie = TELUGU_MOVIES[0];

test('Telugu movie starter set has distinct post-2000 titles and complete reveal details', () => {
  assert.ok(TELUGU_MOVIES.length >= 4);
  assert.equal(new Set(TELUGU_MOVIES.map(entry => entry.title)).size, TELUGU_MOVIES.length);
  for (const entry of TELUGU_MOVIES) {
    assert.ok(entry.year > 2000 && entry.year <= 2026);
    assert.ok(entry.title && entry.cast && entry.clue);
    assert.equal(new URL(entry.source).protocol, 'https:');
    assert.match(entry.story, /^[A-Z].*\.$/);
  }
});

test('charades checkpoints keep their category and reject mismatched prompts', () => {
  const state = {
    players: 4, duration: 60, category: 'telugu-movies', phase: 'scoring',
    team: 0, actor: 0, score: [1, 0], word: movie.title,
    wordsUsed: [movie.title], guessedCorrect: true, deadline: 0,
  };
  assert.ok(validCharades(state));
  assert.ok(validCharades({ ...state, phase: 'acting', deadline: Date.now() + 60_000 }));
  assert.ok(validCharades({ ...state, phase: 'setup', word: '' }));
  assert.ok(!validCharades({ ...state, category: 'classic' }));
  assert.ok(!validCharades({ ...state, category: 'other' }));
  assert.ok(!validCharades({ ...state, wordsUsed: ['COFFEE'] }));
  assert.ok(!validCharades({ ...state, wordsUsed: [] }));
  assert.ok(validCharades({ ...state, category: undefined, word: 'SWIMMING', wordsUsed: ['SWIMMING'] }));
});

test('imposter checkpoints require a clue from the selected category', () => {
  const state = {
    players: 4, category: 'telugu-movies', phase: 'setup', currentPlayer: 0,
    imposterIndex: 2, word: movie.title, clue: movie.clue,
    votes: [null, null, null, null],
  };
  assert.ok(validImposter(state));
  assert.ok(validImposter({ ...state, phase: 'reveal' }));
  assert.ok(!validImposter({ ...state, category: 'everyday' }));
  assert.ok(!validImposter({ ...state, category: 'other' }));
  assert.ok(!validImposter({ ...state, clue: 'Made-up clue' }));
  assert.ok(validImposter({
    ...state, category: undefined, word: 'COFFEE', clue: 'Hot drink',
  }));
});

function withDOM() {
  const previous = { document: globalThis.document, window: globalThis.window, localStorage: globalThis.localStorage };
  const listeners = new Map();
  const makeElement = () => {
    const children = [];
    const handlers = new Map();
    const element = {
      children, handlers, style: { setProperty() {} }, classList: { add() {} },
      innerHTML: '', textContent: '',
      appendChild(child) { children.push(child); },
      addEventListener(event, handler) { handlers.set(event, handler); },
      querySelector(selector) {
        if (!this.controls) this.controls = new Map();
        if (!this.controls.has(selector)) this.controls.set(selector, makeElement());
        return this.controls.get(selector);
      },
      querySelectorAll(selector) {
        if (selector !== '.imp-vote-btn') return [];
        if (!this.voteButtons) this.voteButtons = Array.from({ length: 4 }, (_, index) => {
          const button = makeElement();
          button.dataset = { vote: String(index) };
          return button;
        });
        return this.voteButtons;
      },
    };
    return element;
  };
  globalThis.document = {
    hidden: false, createElement: makeElement,
    addEventListener(event, handler) { listeners.set(event, handler); },
    removeEventListener(event) { listeners.delete(event); },
  };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.localStorage = { getItem() { return null; }, setItem() {} };
  return {
    makeElement, listeners,
    restore() {
      globalThis.document = previous.document;
      globalThis.window = previous.window;
      globalThis.localStorage = previous.localStorage;
    },
  };
}

test('charades only shows movie details after the turn ends', async () => {
  const dom = withDOM();
  try {
    const base = {
      players: 4, duration: 60, category: 'telugu-movies',
      team: 0, actor: 0, score: [0, 0], word: movie.title,
      wordsUsed: [movie.title], guessedCorrect: false, deadline: 0,
    };
    const container = dom.makeElement();
    let state = { ...base, phase: 'scoring' };
    const session = { get state() { return state; }, save(next) { state = next; } };
    const game = await charades.render(container, { color: '#fff' }, { session });
    const card = container.children[0].querySelector('.game-stage').children[0];
    assert.match(card.innerHTML, new RegExp(movie.story));
    assert.match(card.innerHTML, new RegExp(String(movie.year)));
    assert.ok(card.innerHTML.includes(movie.cast));
    game.dispose();

    state = { ...base, phase: 'acting', deadline: Date.now() + 60_000 };
    const actingContainer = dom.makeElement();
    const actingGame = await charades.render(actingContainer, { color: '#fff' }, { session });
    const actingCard = actingContainer.children[0].querySelector('.game-stage').children[0];
    assert.ok(actingCard.innerHTML.includes(movie.title));
    assert.ok(!actingCard.innerHTML.includes(movie.story));
    assert.ok(!actingCard.innerHTML.includes(movie.cast));
    actingGame.dispose();

    state = { ...base, category: 'classic', phase: 'scoring', word: 'SWIMMING', wordsUsed: ['SWIMMING'] };
    const classicContainer = dom.makeElement();
    const classicGame = await charades.render(classicContainer, { color: '#fff' }, { session });
    const classicCard = classicContainer.children[0].querySelector('.game-stage').children[0];
    assert.ok(classicCard.innerHTML.includes('SWIMMING'));
    assert.ok(!classicCard.innerHTML.includes(movie.story));
    classicGame.dispose();
  } finally {
    dom.restore();
  }
});

test('imposter resumed reveals stay face-down; only results show film details', async () => {
  const dom = withDOM();
  try {
    let state = {
      players: 4, category: 'telugu-movies', phase: 'reveal', currentPlayer: 1,
      imposterIndex: 1, word: movie.title, clue: movie.clue,
      votes: [null, null, null, null],
    };
    let finished = 0;
    const session = { get state() { return state; }, save(next) { state = next; }, finish() { finished++; } };
    const container = dom.makeElement();
    const game = await imposter.render(container, { color: '#fff' }, { session });
    const card = container.children[0].querySelector('.game-stage').children[0];
    assert.equal(state.phase, 'setup');
    assert.ok(!card.innerHTML.includes(movie.title));
    card.querySelector('#showCard').handlers.get('click')();
    assert.ok(card.innerHTML.includes(movie.clue));
    assert.ok(!card.innerHTML.includes(movie.title));
    assert.ok(!card.innerHTML.includes(movie.story));
    document.hidden = true;
    dom.listeners.get('visibilitychange')();
    assert.equal(state.phase, 'setup');
    assert.ok(!card.innerHTML.includes(movie.clue));
    game.dispose();

    state = { ...state, phase: 'vote', currentPlayer: 3, votes: [1, 0, 0, null] };
    const resultContainer = dom.makeElement();
    const resultGame = await imposter.render(resultContainer, { color: '#fff' }, { session });
    const resultCard = resultContainer.children[0].querySelector('.game-stage').children[0];
    assert.ok(!resultCard.innerHTML.includes(movie.story));
    resultCard.querySelector('#submitVote').handlers.get('click')(); // no selection yet
    assert.equal(state.phase, 'vote');
    const voteButtons = resultCard.querySelectorAll('.imp-vote-btn');
    voteButtons[0].handlers.get('click')();
    resultCard.querySelector('#submitVote').handlers.get('click')();
    assert.equal(finished, 1);
    assert.ok(resultCard.innerHTML.includes(movie.story));
    assert.ok(resultCard.innerHTML.includes(movie.cast));
    assert.ok(resultCard.innerHTML.includes(String(movie.year)));
    resultGame.dispose();
  } finally {
    dom.restore();
  }
});
