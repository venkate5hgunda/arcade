import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  IMPOSTER_CATEGORIES,
  WORD_CATEGORY_IDS,
  maxImposters,
  newImposter,
  validImposter,
  imposterWinner,
  hideImposterCard,
  beginImposterVote,
  lockImposterVote,
  nextImposterRound,
  migrateImposter,
} from '../../src/lib/imposter.ts';
import { validCheckpoint } from '../../src/lib/checkpoints.ts';
test('Imposter catalog, limits and checkpoints agree with the original through a complete vote', async () => {
  const original = await import(
      pathToFileURL(resolve('../games/imposter.js')).href
    ),
    words = await import(
      pathToFileURL(resolve('../js/imposter-words.js')).href
    );
  assert.deepEqual(IMPOSTER_CATEGORIES, words.IMPOSTER_CATEGORIES);
  assert.deepEqual(WORD_CATEGORY_IDS, words.WORD_CATEGORY_IDS);
  for (let n = 3; n <= 20; n++)
    assert.equal(maxImposters(n), original.maxImposters(n));
  for (const mode of ['classic', 'pair'] as const) {
    let s = newImposter(
      4,
      mode,
      [1, 1],
      ['category', 'hint', 'team'],
      ['food'],
      {},
      [],
      () => 0,
    );
    assert.equal(validImposter(s, []), original.validCheckpoint(s, []));
    assert.ok(validCheckpoint('imposter', s));
    for (let i = 0; i < 4; i++) s = hideImposterCard(s);
    assert.equal(s.phase, 'discuss');
    s = beginImposterVote(s);
    const spy = s.imposters[0],
      target = spy === 0 ? 1 : spy;
    for (let i = 0; i < 4; i++) {
      const vote = i === target ? (target === 0 ? 1 : 0) : target;
      s = lockImposterVote(s, vote);
      if (s.phase !== 'result')
        assert.equal(validImposter(s, []), original.validCheckpoint(s, []));
    }
    assert.equal(s.phase, 'result');
    assert.ok(imposterWinner(s));
    assert.equal(validCheckpoint('imposter', s), false);
  }
});
test('votes conceal roles, ties eliminate nobody, and original legacy saves migrate', async () => {
  let s = newImposter(4, 'classic', [1, 1], [], ['food'], {}, [], () => 0);
  for (let i = 0; i < 4; i++) s = hideImposterCard(s);
  s = beginImposterVote(s);
  for (const vote of [1, 0, 3, 2]) s = lockImposterVote(s, vote);
  assert.equal(s.phase, 'verdict');
  assert.deepEqual(s.out, []);
  assert.equal(s.history[0].out, null);
  s = nextImposterRound(s, () => 0);
  assert.equal(s.phase, 'discuss');
  const old = {
    players: 4,
    imposterIndex: 1,
    word: 'COFFEE',
    clue: 'Hot drink',
    phase: 'setup',
    currentPlayer: 0,
    votes: [null, null, null, null],
  };
  const original = await import(
    pathToFileURL(resolve('../games/imposter.js')).href
  );
  assert.equal(validImposter(old, []), original.validCheckpoint(old, []));
  assert.equal(migrateImposter(old).category, 'everyday');
  const voting = { ...s, phase: 'vote' as const };
  assert.equal(lockImposterVote(voting, 0), voting);
});

test('Pair mode never picks a movie category that cannot supply a decoy', () => {
  const one = [
    {
      id: 'a',
      title: 'One',
      year: 2024,
      difficulty: 1,
      approval: 'editorial',
      prompt: 'One (2024)',
      clue: 'Cinema',
    },
  ];
  const s = newImposter(
    4,
    'pair',
    [1, 1],
    [],
    ['telugu-movies', 'food'],
    {},
    one,
    () => 0,
  );
  assert.equal(s.category, 'food');
  assert.ok(s.decoy);
  assert.ok(validImposter(s, one));
});
