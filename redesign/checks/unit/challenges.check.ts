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

test('Tiles generated layers always clear legally, maintain even pattern counts and replay exact combos', async () => {
  const { newTiles, tilesProgress, actTiles, validTiles } = await import(
    '../../src/lib/tiles.ts'
  );
  for (let seed = 0; seed < 50; seed++) {
    let s = { ...newTiles('practice', 4), seed };
    for (let move = 0; move < 18 && !tilesProgress(s).done; move++) {
      const board = tilesProgress(s).board;
      let pair: number[] | null = null;
      for (let a = 0; a < 12 && !pair; a++)
        for (let b = a + 1; b < 12; b++)
          if (board[a].some((n, i) => n >= 0 && n === board[b][i])) {
            pair = [a, b];
            break;
          }
      assert.ok(pair);
      const next = actTiles(s, { type: 'match', tiles: pair }).state;
      assert.notEqual(next, s);
      s = next;
      assert.ok(validTiles(s, true));
    }
    assert.ok(tilesProgress(s).done);
    assert.equal(validTiles(s), false);
  }
  const s = newTiles('practice');
  assert.equal(actTiles(s, { type: 'match', tiles: [0, 0] }).state, s);
  assert.equal(validTiles({ ...s, moves: [[0, 0]] }), false);
});

test('Sudoku generates unique solutions at each tier, protects givens and saves notes/assistance', async () => {
  const {
    newSudoku,
    sudokuPuzzle,
    sudokuSolutions,
    actSudoku,
    sudokuDone,
    validSudoku,
    sudokuConflicts,
  } = await import('../../src/lib/sudoku.ts');
  for (const difficulty of ['easy', 'medium', 'hard'] as const)
    for (let seed = 0; seed < 6; seed++) {
      const p = sudokuPuzzle(seed, difficulty);
      assert.equal(sudokuSolutions(p.givens), 1);
      assert.equal(sudokuSolutions(p.solution), 1);
      assert.ok(
        p.givens.filter(Boolean).length <=
          { easy: 40, medium: 33, hard: 32 }[difficulty],
      );
      const s = {
        ...newSudoku('practice', difficulty),
        seed,
        values: [...p.givens],
      };
      assert.ok(validSudoku(s));
      const empty = p.givens.findIndex((n) => !n),
        given = p.givens.findIndex(Boolean);
      assert.equal(
        actSudoku(s, { type: 'entry', cell: given, value: 0 }).state,
        s,
      );
      const noted = actSudoku(s, { type: 'note', cell: empty, value: 3 }).state;
      assert.deepEqual(noted.notes[empty], [3]);
      const revealed = actSudoku(noted, { type: 'hint', cell: empty }).state;
      assert.deepEqual(revealed.notes[empty], []);
      assert.ok(validSudoku(revealed));
      const finished = { ...s, values: [...p.solution] };
      assert.ok(sudokuDone(finished));
      assert.equal(sudokuConflicts(finished).length, 0);
      assert.equal(validSudoku(finished), false);
      assert.ok(validSudoku(finished, true));
      assert.equal(validSudoku({ ...s, values: Array(81).fill(1) }), false);
    }
  assert.equal(sudokuSolutions(Array(81).fill(1)), 0);
});

test('Quoridor validates movement, straight jumps, blocked-jump sidesteps and a finished race', async () => {
  const { newQuoridor, quoridorMoves, actQuoridor, validQuoridor } =
    await import('../../src/lib/quoridor.ts');
  const start = newQuoridor();
  assert.deepEqual(new Set(quoridorMoves(start)), new Set([3, 5, 13]));
  assert.equal(actQuoridor(start, { type: 'move', cell: 22 }).state, start);
  const facing = { ...start, pawns: [4, 13] as [number, number] };
  assert.ok(quoridorMoves(facing).includes(22));
  assert.ok(!quoridorMoves(facing).includes(12));
  const blocked = {
    ...facing,
    walls: [{ row: 1, col: 4, orientation: 'h' as const, owner: 0 as const }],
  };
  assert.ok(quoridorMoves(blocked).includes(12));
  assert.ok(quoridorMoves(blocked).includes(14));
  assert.ok(!quoridorMoves(blocked).includes(22));
  const finish = { ...start, pawns: [67, 72] as [number, number] };
  const won = actQuoridor(finish, { type: 'move', cell: 76 }).state;
  assert.equal(won.winner, 0);
  assert.ok(validQuoridor(won, true));
  assert.equal(validQuoridor(won), false);
  assert.equal(actQuoridor(won, { type: 'move', cell: 75 }).state, won);
  assert.deepEqual(start.pawns, [4, 76]);
});
test('Quoridor rejects crossing/overlapping walls and complete blocks with BFS for both goals', async () => {
  const {
    newQuoridor,
    actQuoridor,
    quoridorWallError,
    validQuoridor,
    quoridorPath,
  } = await import('../../src/lib/quoridor.ts');
  let s = newQuoridor();
  s = actQuoridor(s, { type: 'wall', row: 3, col: 3, orientation: 'h' }).state;
  assert.ok(quoridorWallError(s, { row: 3, col: 3, orientation: 'v' }));
  assert.ok(quoridorWallError(s, { row: 3, col: 4, orientation: 'h' }));
  assert.ok(validQuoridor(s));
  const partial = {
    ...newQuoridor(),
    walls: [0, 2, 4, 6].map((col) => ({
      row: 0,
      col,
      orientation: 'h' as const,
      owner: 0 as const,
    })),
  };
  assert.ok(quoridorPath(4, 8, partial.walls));
  assert.match(
    quoridorWallError(partial, { row: 0, col: 7, orientation: 'v' })!,
    /route/,
  );
  assert.equal(
    actQuoridor(partial, { type: 'wall', row: 0, col: 7, orientation: 'v' })
      .state,
    partial,
  );
  const closed = {
    ...partial,
    walls: [
      ...partial.walls,
      { row: 0, col: 7, orientation: 'v' as const, owner: 1 as const },
    ],
  };
  assert.equal(validQuoridor(closed), false);
  const spent = {
    ...newQuoridor(),
    walls: [
      ...Array.from({ length: 8 }, (_, row) => ({
        row,
        col: 0,
        orientation: 'h' as const,
        owner: 0 as const,
      })),
      { row: 0, col: 3, orientation: 'h' as const, owner: 0 as const },
      { row: 1, col: 3, orientation: 'h' as const, owner: 0 as const },
    ],
  };
  assert.ok(validQuoridor(spent));
  assert.match(
    quoridorWallError(spent, { row: 7, col: 7, orientation: 'v' })!,
    /no walls/,
  );
});
