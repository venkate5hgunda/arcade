import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { newStrands, strandsPuzzle } from '../../src/lib/strands.ts';
async function seed(page: Page, id: string, state: object) {
  await page.goto('/');
  await page.evaluate(
    ({ id, state }) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ [id]: { state, savedAt: Date.now() } }),
      ),
    { id, state },
  );
  await page.goto(`/#/game/${id}`);
}
test('Strands traces a spangram, restores a grid and completes the theme without overflow', async ({
  page,
}) => {
  test.setTimeout(90000);
  const state = { ...newStrands('practice'), seed: 0 },
    puzzle = strandsPuzzle(0);
  state.found = puzzle.paths.slice(1).map((path, i) => ({ word: i + 1, path }));
  await seed(page, 'strands', state);
  await expect(page.locator('.strands-grid button')).toHaveCount(48);
  await page.reload();
  for (const cell of puzzle.paths[0])
    await page.locator('.strands-grid button').nth(cell).click();
  await page.getByRole('button', { name: 'Submit word' }).click();
  await expect(
    page.getByRole('heading', { name: 'Puzzle complete!' }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `node_modules/.cache/strands-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test('Strands daily setup, hints, tap undo and room entry work', async ({
  page,
}) => {
  await page.goto('/#/game/strands');
  await expect(page.locator('.puzzle-setup-art')).toBeVisible();
  await page.getByRole('button', { name: 'Start playing' }).click();
  await page.getByRole('button', { name: 'Hint (3)' }).click();
  await expect(page.locator('.hinted')).toHaveCount(1);
  const hint = page.locator('.hinted');
  await hint.click();
  await expect(hint).toHaveAttribute('aria-pressed', 'true');
  await hint.click();
  await expect(hint).toHaveAttribute('aria-pressed', 'false');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
