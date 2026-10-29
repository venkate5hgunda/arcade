import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  loadMovies,
  filterMovies,
  normalizeMovieFilters,
} from '../../src/lib/movies.ts';
import {
  CHARADES_WORDS,
  newCharades,
  validCharades,
  beginCharades,
  scoreCharades,
  nextCharades,
} from '../../src/lib/charades.ts';
test('approved movie pipeline, original filters and charades checkpoint shape remain compatible', async () => {
  const fetcher = async (url: string | URL | Request) => {
    try {
      const text = readFileSync(
        resolve('../data/movies', String(url).split('/').at(-1)!),
        'utf8',
      );
      return new Response(text, { status: 200 });
    } catch {
      return new Response('', { status: 404 });
    }
  };
  const movies = await loadMovies('data/', fetcher as typeof fetch);
  assert.equal(movies.length, 4814);
  const original = await import(
      pathToFileURL(resolve('../js/movie-library.js')).href
    ),
    game = await import(
      pathToFileURL(resolve('../games/dumb-charades.js')).href
    );
  const filters = { yearRange: [2000, 2024], difficulties: ['1', '3'] };
  assert.deepEqual(
    filterMovies(movies, filters).map((m) => m.id),
    original.filterMovies(movies, filters).map((m: { id: string }) => m.id),
  );
  assert.deepEqual(
    normalizeMovieFilters(movies, { period: 'older', difficulty: '2' }),
    {
      yearRange: [
        Math.min(
          ...movies.map((m) => m.year).filter((n): n is number => n !== null),
        ),
        1999,
      ],
      difficulties: ['2'],
    },
  );
  for (const category of ['classic', 'telugu-movies'] as const) {
    let s = newCharades(4, 60, category, filters);
    assert.equal(validCharades(s, movies), game.validCheckpoint(s, movies));
    s = beginCharades(s, movies, 100, () => 0);
    assert.equal(s.deadline, 60100);
    assert.equal(validCharades(s, movies), game.validCheckpoint(s, movies));
    assert.ok(
      category === 'classic'
        ? CHARADES_WORDS.includes(s.word)
        : s.word.includes('('),
    );
    s = scoreCharades(s, true);
    assert.deepEqual(s.score, [1, 0]);
    assert.equal(validCharades(s, movies), game.validCheckpoint(s, movies));
    s = nextCharades(s);
    assert.equal(s.team, 1);
    assert.equal(s.word, '');
    assert.equal(validCharades(s, movies), game.validCheckpoint(s, movies));
  }
  await assert.rejects(
    loadMovies('data/', async () => new Response('', { status: 404 }) as never),
    /could not load/,
  );
});
test('charades alternates teams, rotates actors, ends after ten successes and ignores duplicate scoring', () => {
  let s = newCharades(4, 10, 'classic', {});
  for (let i = 0; i < 10; i++) {
    s = beginCharades(s, [], 0, () => 0);
    s = scoreCharades(s, true);
    assert.equal(scoreCharades(s, true), s);
    s = nextCharades(s);
  }
  assert.equal(s.phase, 'gameover');
  assert.deepEqual(s.score, [5, 5]);
  assert.equal(s.actor, 1);
});
