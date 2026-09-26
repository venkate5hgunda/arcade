import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GAMES } from '../js/game-catalog.js';
import { iconMarkup } from '../js/icons.js';

test('every game has distinct, locally available SVG artwork', async () => {
  assert.equal(new Set(GAMES.map(({ icon }) => icon)).size, GAMES.length);
  for (const game of GAMES) {
    const [collection, name] = game.icon.split(':');
    assert.ok(['game-icons', 'tabler'].includes(collection), game.id);
    const svg = await readFile(new URL(`../assets/icons/${collection}/${name}.svg`, import.meta.url), 'utf8');
    assert.match(svg, /^<svg\b/);
    assert.match(iconMarkup(game.icon, 'catalog-icon'), new RegExp(`${collection}/${name}\\.svg`));
  }
});
