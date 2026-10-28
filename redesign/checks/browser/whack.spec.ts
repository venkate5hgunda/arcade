import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('Whack-a-Mole restores a timed round, scores hits and misses, ends and replays', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'arcade:game.sessions',
      JSON.stringify({
        'whack-a-mole': {
          state: {
            duration: '30',
            score: 2,
            misses: 1,
            deadline: Date.now() + 4000,
          },
          savedAt: Date.now(),
        },
      }),
    ),
  );
  await page.goto('/#/game/whack-a-mole');
  await expect(page.getByText('Score 2', { exact: true })).toBeVisible();
  const mole = page.getByRole('button', { name: /mole visible/ });
  await expect(mole).toBeVisible();
  await mole.click();
  await expect(page.getByText('Score 3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hole 1', exact: true }).click();
  await page.reload();
  await expect(page.getByText('Score 3', { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByRole('heading', { name: 'Time’s up!' })).toBeVisible({
    timeout: 7000,
  });
  await expect(page.getByText('Score 3 · 2 misses')).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:game.sessions') ?? '{}')[
          'whack-a-mole'
        ],
    ),
  ).toBeUndefined();
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByText('Score 0', { exact: true })).toBeVisible();
  await expect(page.getByText('Best 3', { exact: true })).toBeVisible();
});
