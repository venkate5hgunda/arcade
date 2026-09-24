import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../js/game-catalog.js';
import { GAME_HELP, openGameHelp } from '../js/game-help.js';

test('every catalog game has visual steps, controls, options and a goal', () => {
  assert.deepEqual(Object.keys(GAME_HELP).sort(), GAMES.map(game => game.id).sort());
  for (const game of GAMES) {
    const help = GAME_HELP[game.id];
    assert.equal(help.steps.length, 3, game.id);
    for (const step of help.steps) {
      assert.equal(step.length, 3);
      assert.ok(step.every(value => typeof value === 'string' && value.trim()), game.id);
    }
    for (const field of ['controls', 'options', 'goal'])
      assert.ok(typeof help[field] === 'string' && help[field].trim(), `${game.id}: ${field}`);
  }
  assert.throws(() => openGameHelp('unknown-game'), /No instructions/);
});
