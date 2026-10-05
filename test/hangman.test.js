import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HANGMAN_WORDS, MAX_MISSES, createHangman, guessHangman, validHangmanState, wordCategory } from '../games/hangman-engine.js';

const fresh = (players = '1') => createHangman(players, () => 0);
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

test('Hangman preserves its original 85-word pool and supports both player modes', () => {
  assert.equal(HANGMAN_WORDS.length, 85);
  assert.equal(new Set(HANGMAN_WORDS).size, 85);
  for (const players of ['1', '2']) {
    assert.deepEqual(fresh(players), { players, word: 'ARCADE', guessed: [],
      wrong: 0, current: 1, scores: { 1: 0, 2: 0 } });
    assert.ok(validHangmanState(fresh(players)));
  }
  assert.equal(createHangman('1', () => .999999).word, 'CASE');
  assert.equal(MAX_MISSES, 6);
});

test('Invalid modes and random sources fail explicitly', () => {
  for (const players of [null, undefined, 1, '3', '', {}]) {
    if (players !== undefined) assert.throws(() => fresh(players));
  }
  for (const value of [-1, 1, NaN, Infinity, '0', null])
    assert.throws(() => createHangman('1', () => value));
});

test('A correct letter reveals every occurrence and leaves the input unchanged', () => {
  const original = fresh();
  const before = structuredClone(original);
  const result = guessHangman(original, 'A');
  assert.equal(result.correct, true);
  assert.equal(result.occurrences, 2);
  assert.equal(result.outcome, null);
  assert.equal(result.state.wrong, 0);
  assert.deepEqual(original, before);
  assert.deepEqual(result.state.guessed, ['A']);
  assert.ok(validHangmanState(result.state));
  assert.notEqual(result.state.scores, original.scores);
});

test('Both correct and incorrect nonterminal guesses alternate two-player turns', () => {
  let state = fresh('2');
  state = guessHangman(state, 'A').state;
  assert.equal(state.current, 2);
  state = guessHangman(state, 'B').state;
  assert.equal(state.current, 1);
  assert.equal(state.wrong, 1);
  assert.deepEqual(state.scores, { 1: 0, 2: 0 });
});

test('Only the final guessing player wins and terminal states cannot be resumed', () => {
  let state = fresh('2'), result;
  for (const letter of new Set(state.word)) { result = guessHangman(state, letter); state = result.state; }
  assert.equal(result.outcome, 'win');
  assert.equal(state.current, 1);
  assert.deepEqual(state.scores, { 1: 1, 2: 0 });
  assert.equal(validHangmanState(state), false);
  assert.throws(() => guessHangman(state, 'Z'));
});

test('The sixth miss ends the round without assigning a victory or advancing the turn', () => {
  let state = fresh('2'), result;
  const misses = [...letters].filter(letter => !state.word.includes(letter)).slice(0, MAX_MISSES);
  for (let i = 0; i < misses.length; i++) {
    const actor = state.current;
    result = guessHangman(state, misses[i]); state = result.state;
    assert.equal(state.wrong, i + 1);
    assert.equal(result.outcome, i === 5 ? 'loss' : null);
    if (i === 5) assert.equal(state.current, actor);
    else assert.ok(validHangmanState(state));
  }
  assert.equal(validHangmanState(state), false);
  assert.deepEqual(state.scores, { 1: 0, 2: 0 });
});

test('Repeated, lowercase, nonletter and multi-letter guesses do not mutate a round', () => {
  const state = guessHangman(fresh(), 'A').state;
  const original = structuredClone(state);
  for (const letter of ['A', 'a', 'AB', '1', '', null, undefined, {}, 'é']) {
    assert.throws(() => guessHangman(state, letter));
    assert.deepEqual(state, original);
  }
});

test('Malformed, inconsistent and finished checkpoints are rejected', () => {
  for (const state of [null, undefined, [], {}, 3, 'word']) assert.equal(validHangmanState(state), false);
  const patches = [
    { players: '3' }, { players: 2 }, { word: 'NOTINPOOL' }, { word: null },
    { guessed: ['AA'] }, { guessed: ['a'] }, { guessed: ['A', 'A'] }, { guessed: null },
    { guessed: ['B'], wrong: 0 }, { guessed: ['A'], wrong: 1 }, { wrong: -1 },
    { wrong: .5 }, { wrong: 6 }, { current: 3 }, { current: 2 }, { scores: null },
    { scores: [0, 0] }, { scores: { 1: 1, 2: 0 } }, { scores: { 1: 0 } },
    { guessed: [...new Set('ARCADE')] },
  ];
  for (const patch of patches) assert.equal(validHangmanState({ ...fresh(), ...patch }), false, JSON.stringify(patch));
});

test('Legacy checkpoint shape restores and injected outcome cannot alter the rules', () => {
  const checkpoint = { players: '2', word: 'ARCADE', guessed: ['B', 'A'],
    wrong: 1, current: 1, scores: { 1: 0, 2: 0 } };
  assert.ok(validHangmanState(checkpoint));
  const result = guessHangman({ ...checkpoint, outcome: 'win' }, 'R');
  assert.equal(result.outcome, null);
  assert.equal(Object.hasOwn(result.state, 'outcome'), false);
  assert.deepEqual(Object.keys(result.state), ['players', 'word', 'guessed', 'wrong', 'current', 'scores']);
});

test('Every word has a topic hint and can be won with exactly its distinct letters', () => {
  for (const word of HANGMAN_WORDS) {
    assert.equal(typeof wordCategory(word), 'string');
    let state = { ...fresh(), word }, result;
    for (const letter of new Set(word)) { result = guessHangman(state, letter); state = result.state; }
    assert.equal(result.outcome, 'win', word);
    assert.equal(state.wrong, 0);
    assert.deepEqual(state.scores, { 1: 1, 2: 0 });
  }
  assert.throws(() => wordCategory('UNKNOWN'));
});

test('New interface and garden assets are wired for both normal and offline loading', () => {
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  for (const file of ['css/game-interface.css', 'css/hangman.css']) {
    assert.ok(index.includes(`href="${file}"`));
    assert.ok(sw.includes(`'./${file}'`));
  }
  assert.ok(sw.includes("'./assets/hangman/word-garden.svg'"));
  assert.ok(sw.includes("'hangman-engine'"));
  const art = readFileSync(new URL('../assets/hangman/word-garden.svg', import.meta.url), 'utf8');
  const ids = [...art.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const [, ref] of art.matchAll(/(?:href="#|url\(#)([^")]+)/g)) assert.ok(ids.includes(ref), ref);
});
