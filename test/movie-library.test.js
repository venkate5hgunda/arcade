import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadApprovedMovies, filterMovies, uniquePrompts, movieSetupError, escapeHTML, movieDetails, difficultyLabel, movieFilterFields } from '../js/movie-library.js';
import { validCheckpoint as validCharades } from '../games/dumb-charades.js';
import { validCheckpoint as validImposter } from '../games/imposter.js';

const fetchLocal = async url => {
  const text = await readFile(url, 'utf8');
  return { ok: true, json: async () => JSON.parse(text), text: async () => text };
};

test('published movie library loads thousands of approved scores with full reasoning', async () => {
  const movies = await loadApprovedMovies(fetchLocal);
  assert.ok(movies.length >= 4500);
  assert.ok(movies.some(movie => movie.year < 2000));
  assert.ok(movies.some(movie => movie.approval === 'llm_reviewed'));
  for (let value = 1; value <= 5; value++) {
    const selected = filterMovies(movies, { difficulty: String(value) });
    assert.ok(selected.length > 0);
    assert.ok(selected.every(movie => movie.difficulty === value));
    assert.match(difficultyLabel(String(value)), new RegExp(`${value}/5`));
  }
  assert.ok(movies.every(movie => movie.reason && movie.components.actability.reason &&
    movie.components.recognition.reason && movie.components.title_complexity.reason));
  const movie = movies.find(movie => movie.approval === 'llm_reviewed');
  const state = {
    players: 4, duration: 60, category: 'telugu-movies', period: 'all', difficulty: 'all',
    phase: 'scoring', team: 0, actor: 0, score: [0, 0], word: movie.prompt,
    wordsUsed: [movie.prompt], guessedCorrect: false, deadline: 0,
  };
  assert.ok(validCharades(state, movies));
  assert.ok(!validCharades({ ...state, difficulty: String(movie.difficulty === 1 ? 2 : 1) }, movies));
  assert.ok(validImposter({
    ...state, phase: 'setup', currentPlayer: 0, imposterIndex: 1,
    clue: movie.clue, votes: [null, null, null, null],
  }, movies));
});

test('year presets, custom inclusive ranges, difficulty, and empty selections are explicit', () => {
  const movies = [
    { title: 'Old', prompt: 'Old (1980)', year: 1980, difficulty: 1 },
    { title: 'New', prompt: 'New (2000)', year: 2000, difficulty: 4 },
    { title: 'New', prompt: 'New (2000)', year: 2000, difficulty: 4 },
  ];
  assert.equal(filterMovies(movies, { period: '2000' }).length, 2);
  assert.equal(filterMovies(movies, { period: 'older', difficulty: '1' }).length, 1);
  assert.equal(filterMovies(movies, { period: 'custom', fromYear: '1980', toYear: '1980' }).length, 1);
  assert.equal(uniquePrompts(movies).length, 2);
  assert.match(movieSetupError(movies, { category: 'telugu-movies', period: 'custom', fromYear: '2001', toYear: '2000' }), /valid timespan/);
  assert.match(movieSetupError(movies, { category: 'telugu-movies', difficulty: '5' }), /No approved/);
});

test('provider/model text is escaped and unavailable data is not silently replaced by starters', async () => {
  assert.equal(escapeHTML('<script>"&'), '&lt;script&gt;&quot;&amp;');
  assert.ok(!movieDetails({ year: 2000, story: '<img>', cast: '<script>' }).includes('<img>'));
  await assert.rejects(loadApprovedMovies(async () => ({ ok: false, status: 503 })), /503/);
});

test('year slider and multiple difficulty choices preserve inclusive boundaries and legacy settings', () => {
  const movies = [
    { year: 1980, difficulty: 1 }, { year: 2000, difficulty: 2 },
    { year: 2010, difficulty: 4 }, { year: null, difficulty: 1 },
  ];
  const fields = movieFilterFields({ period: 'older', difficulty: '2' }, movies);
  assert.deepEqual(fields[0].default, [1980, 1999]);
  assert.deepEqual(fields[1].default, ['2']);
  assert.equal(fields[0].type, 'range');
  assert.equal(fields[1].type, 'multiple');
  const selection = { category: 'telugu-movies', yearRange: [1980, 2000], difficulties: ['1', '2'] };
  assert.deepEqual(filterMovies(movies, selection), movies.slice(0, 2));
  assert.equal(movieSetupError(movies, selection), '');
  assert.match(movieSetupError(movies, { ...selection, difficulties: [] }), /at least one/);
  assert.match(movieSetupError(movies, { ...selection, yearRange: [2000, 1980] }), /valid year/);
  assert.equal(difficultyLabel(['1', '3']), 'Easy + Moderate');
  assert.deepEqual(movieFilterFields({ yearRange: [1980, 2000], difficulties: ['1', '3'] }, movies).map(field => field.default),
    [[1980, 2000], ['1', '3']]);
});
