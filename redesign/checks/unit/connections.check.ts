import test from 'node:test';
import assert from 'node:assert/strict';
import { CONNECTIONS_PUZZLES } from '../../src/data/connections.ts';
import {
  connectionsProgress,
  dateKey,
  dailyPuzzle,
  newConnections,
  submitConnections,
  validConnections,
} from '../../src/lib/connections.ts';
import { validCheckpoint } from '../../src/lib/checkpoints.ts';
import { localCue } from '../../src/lib/game-feedback.ts';

test('24 original sets have four unambiguous four-word groups and every solution completes legally', () => {
  assert.equal(CONNECTIONS_PUZZLES.length, 24);
  assert.equal(new Set(CONNECTIONS_PUZZLES.map((p) => p.id)).size, 24);
  for (const puzzle of CONNECTIONS_PUZZLES) {
    assert.equal(puzzle.groups.length, 4);
    assert.equal(new Set(puzzle.groups.map((g) => g.name)).size, 4);
    assert.equal(
      new Set(puzzle.groups.flatMap((g) => g.words)).size,
      16,
      puzzle.id,
    );
    let state = { puzzleId: puzzle.id, date: null, guesses: [] } as ReturnType<
      typeof newConnections
    >;
    for (const group of [2, 0, 3, 1]) {
      assert.equal(puzzle.groups[group].words.length, 4);
      assert.ok(puzzle.groups[group].words.every((w) => /^[A-Z-]+$/.test(w)));
      state = submitConnections(
        state,
        [3, 1, 0, 2].map((n) => n + group * 4),
      ).state;
      assert.ok(validConnections(state, true));
    }
    assert.equal(connectionsProgress(state).won, true);
    assert.equal(
      validCheckpoint('connections', state),
      false,
      'finished games never resume',
    );
  }
});

test('daily selection uses the local calendar date, stays deterministic, and practice remains bundled', () => {
  const now = new Date(2026, 10, 9, 23, 59);
  const state = newConnections('daily', now);
  assert.equal(state.date, '2026-11-09');
  assert.equal(dateKey(now), state.date);
  assert.equal(state.puzzleId, dailyPuzzle('2026-11-09').id);
  assert.equal(
    newConnections('daily', new Date(2026, 10, 9, 0, 1)).puzzleId,
    state.puzzleId,
  );
  assert.notEqual(
    newConnections('daily', new Date(2026, 10, 10)).puzzleId,
    state.puzzleId,
  );
  assert.equal(
    newConnections('practice', now, () => 0).puzzleId,
    CONNECTIONS_PUZZLES[0].id,
  );
  assert.equal(newConnections('practice', now, () => 0).date, null);
  assert.ok(validConnections(newConnections('daily', new Date(1969, 11, 31))));
});

test('guesses enforce distinct unsolved words, ignore repeats and stop at the fourth mistake', () => {
  const state = newConnections('practice', undefined, () => 0);
  for (const guess of [
    null,
    {},
    '0123',
    [],
    [0, 0, 1, 2],
    [-1, 0, 1, 2],
    [0, 1, 2, 16],
    [0, 1, 2, 3.5],
  ])
    assert.equal(submitConnections(state, guess).state, state);
  const miss = submitConnections(state, [0, 1, 2, 4]);
  assert.match(miss.message, /One away/);
  assert.equal(connectionsProgress(miss.state).mistakes, 1);
  assert.equal(
    submitConnections(miss.state, [4, 2, 0, 1]).state,
    miss.state,
    'reordered duplicate costs no mistake',
  );
  let next = submitConnections(miss.state, [3, 2, 1, 0]).state;
  assert.equal(connectionsProgress(next).solved.length, 1);
  assert.equal(submitConnections(next, [0, 5, 6, 7]).state, next);
  for (const guess of [
    [4, 5, 6, 8],
    [4, 5, 6, 9],
    [4, 5, 6, 10],
  ])
    next = submitConnections(next, guess).state;
  assert.deepEqual(connectionsProgress(next), {
    solved: [0],
    mistakes: 4,
    won: false,
    over: true,
  });
  assert.equal(submitConnections(next, [4, 5, 6, 7]).state, next);
  assert.deepEqual(state.guesses, [], 'earlier states are immutable');
  assert.deepEqual(localCue('connections', state, miss.state), {
    sound: 'buzz',
    haptic: 'failure',
  });
});

test('checkpoint replay rejects malformed dates, foreign puzzles, repeated/solved/post-result guesses', () => {
  const base = newConnections('practice', undefined, () => 0);
  const good = submitConnections(base, [0, 1, 2, 4]).state;
  assert.ok(validConnections(good));
  assert.ok(validCheckpoint('connections', good));
  for (const bad of [
    null,
    {},
    [],
    { ...base, puzzleId: 'missing' },
    { ...base, extra: true },
    { ...base, date: '2026-02-30' },
    { ...base, date: {} },
    { ...base, date: 'not-a-date' },
    { ...base, date: '2026-11-09', puzzleId: 'missing' },
    {
      ...base,
      guesses: [
        [0, 1, 2, 3],
        [0, 1, 2, 4],
      ],
    },
    {
      ...base,
      guesses: [
        [0, 1, 2, 4],
        [4, 2, 1, 0],
      ],
    },
    { ...base, guesses: [null] },
  ])
    assert.equal(validConnections(bad, true), false);
  const terminal = {
    ...base,
    guesses: [
      [0, 1, 2, 4],
      [0, 1, 2, 5],
      [0, 1, 2, 6],
      [0, 1, 2, 7],
    ],
  };
  assert.ok(validConnections(terminal, true));
  assert.equal(
    validConnections(
      { ...terminal, guesses: [...terminal.guesses, [0, 1, 2, 3]] },
      true,
    ),
    false,
  );
});
