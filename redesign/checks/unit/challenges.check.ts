import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STRANDS_SETS,
  strandsPuzzle,
  newStrands,
  actStrands,
  strandsDone,
  validStrands,
} from '../../src/lib/strands.ts';
import { validCheckpoint } from '../../src/lib/checkpoints.ts';
test('Strands themes fill all 48 cells, spangrams cross the board and every generated layout solves', () => {
  for (let seed = 0; seed < STRANDS_SETS.length * 12; seed++) {
    const puzzle = strandsPuzzle(seed);
    assert.equal(puzzle.letters.length, 48);
    assert.equal(puzzle.letters.filter(Boolean).length, 48, `seed ${seed}`);
    assert.equal(puzzle.words.join('').length, 48, `seed ${seed}`);
    assert.equal(new Set(puzzle.paths.flat()).size, 48);
    assert.deepEqual(
      new Set(puzzle.paths[0].map((cell) => cell % 6)),
      new Set([0, 1, 2, 3, 4, 5]),
    );
    let state = { ...newStrands('practice'), seed };
    for (const path of puzzle.paths) {
      state = actStrands(state, { type: 'word', path }).state;
      assert.ok(validStrands(state, true));
    }
    assert.ok(strandsDone(state));
    assert.equal(validCheckpoint('strands', state), false);
  }
});
test('Strands validates touching paths, rejects overlaps and duplicate words, and bounds shared hints', () => {
  let state = { ...newStrands('practice'), seed: 0 };
  assert.equal(
    actStrands(state, { type: 'word', path: [0, 47, 2] }).state,
    state,
  );
  assert.equal(
    actStrands(state, { type: 'word', path: [0, 0, 1] }).state,
    state,
  );
  for (let i = 0; i < 3; i++) state = actStrands(state, { type: 'hint' }).state;
  assert.equal(state.hints.length, 3);
  assert.equal(actStrands(state, { type: 'hint' }).state, state);
  const path = strandsPuzzle(state.seed).paths[0];
  state = actStrands(state, { type: 'word', path }).state;
  assert.equal(actStrands(state, { type: 'word', path }).state, state);
  assert.ok(validStrands(state));
  assert.equal(validStrands({ ...state, hints: [0, 0] }), false);
  assert.equal(validStrands({ ...state, found: [{ word: 1, path }] }), false);
});

test('Spelling Bee hives have seven letters, accepted pangrams, exact scoring and completable bounded dictionaries', async () => {
  const { HIVES, beePuzzle, beeScore, beeProgress, newBee, actBee, validBee } =
    await import('../../src/lib/bee.ts');
  for (let seed = 0; seed < HIVES.length; seed++) {
    const puzzle = beePuzzle(seed);
    assert.equal(new Set(puzzle.letters).size, 7);
    assert.ok(puzzle.words.some((w) => new Set(w).size === 7));
    let state = { ...newBee('practice'), seed };
    assert.ok(validBee(state));
    assert.equal(actBee(state, { type: 'word', word: 'ZZZZ' }).state, state);
    for (const word of puzzle.words) {
      const before = state;
      state = actBee(state, { type: 'word', word }).state;
      assert.notEqual(state, before);
      assert.ok(validBee(state, true));
      assert.equal(actBee(state, { type: 'word', word }).state, state);
    }
    assert.equal(beeProgress(state).rank, 'Queen Bee');
    assert.equal(
      beeProgress(state).score,
      puzzle.words.reduce((n, w) => n + beeScore(w), 0),
    );
    assert.equal(validBee(state), false);
    assert.equal(validBee({ ...state, words: ['NOTVALID'] }, true), false);
  }
  assert.equal(beeScore('READ'), 1);
  assert.equal(beeScore('READING'), 14);
});

test('Letter Boxed layouts have twelve distinct letters and legal two-word covering chains', async () => {
  const { newLetter, letterPuzzle, actLetter, letterDone, validLetter } =
    await import('../../src/lib/letter-boxed.ts');
  for (let seed = 0; seed < 24; seed++) {
    const puzzle = letterPuzzle(seed);
    assert.equal(new Set(puzzle.sides.join('')).size, 12);
    let state = { ...newLetter('practice'), seed };
    for (const word of puzzle.solution) {
      const next = actLetter(state, { type: 'word', word }).state;
      assert.notEqual(next, state, `${seed}: ${word}`);
      state = next;
    }
    assert.ok(letterDone(state));
    assert.ok(validLetter(state, true));
    assert.equal(validLetter(state), false);
  }
  const start = { ...newLetter('practice'), seed: 0 },
    first = actLetter(start, { type: 'word', word: 'RAINBOW' }).state;
  assert.equal(actLetter(first, { type: 'word', word: 'DANCE' }).state, first);
  assert.equal(actLetter(start, { type: 'word', word: 'BAD' }).state, start);
  assert.equal(actLetter(start, { type: 'word', word: 'ZZZ' }).state, start);
  assert.deepEqual(actLetter(first, { type: 'undo' }).state.words, []);
});

test('Mini word-square crosswords have valid Across/Down clues and only accept complete correct grids', async () => {
  const { newMini, miniPuzzle, actMini, miniDone, validMini } = await import(
    '../../src/lib/mini.ts'
  );
  for (let seed = 0; seed < 8; seed++) {
    let state = { ...newMini('practice'), seed };
    const p = miniPuzzle(seed);
    assert.equal(p.answer.length, 25);
    assert.equal(p.across.length, 5);
    assert.equal(p.down.length, 5);
    for (let cell = 0; cell < 25; cell++)
      state = actMini(state, {
        type: 'entry',
        cell,
        value: p.answer[cell],
      }).state;
    assert.ok(miniDone(state));
    assert.ok(validMini(state, true));
    assert.equal(validMini(state), false);
  }
  let state = { ...newMini('practice'), seed: 0 };
  assert.equal(
    actMini(state, { type: 'entry', cell: 25, value: 'A' }).state,
    state,
  );
  state = actMini(state, { type: 'reveal', cell: 0 }).state;
  assert.deepEqual(state.revealed, [0]);
  assert.equal(
    actMini(state, { type: 'entry', cell: 0, value: 'Z' }).state,
    state,
  );
  assert.equal(validMini({ ...state, revealed: [0, 0] }), false);
});
