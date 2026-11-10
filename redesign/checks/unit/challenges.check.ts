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
