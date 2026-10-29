import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { newPool } from '../../src/lib/pool.ts';
import type { PoolState } from '../../src/lib/pool.ts';
async function seed(page: Page, s: PoolState) {
  await page.goto('/');
  await page.evaluate(
    (s) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ pool: { state: s, savedAt: Date.now() } }),
      ),
    s,
  );
  await page.goto('/#/game/pool');
}
function eightFixture(legal: boolean) {
  const s = newPool('1');
  s.assignments = legal ? ['solids', 'stripes'] : [null, null];
  for (const b of s.balls) {
    if (b.number > 0 && b.number < 8) b.pocketed = true;
    if (b.number === 0) {
      b.x = 885;
      b.y = 55;
    }
    if (b.number === 8) {
      b.x = 911;
      b.y = 55;
    }
  }
  return s;
}
test('Pool uses keyboard aim and power, completes a break and restores a settled table', async ({
  page,
}) => {
  await page.goto('/#/game/pool');
  await page.getByRole('button', { name: 'Start playing →' }).click();
  const canvas = page.getByRole('img', { name: 'Pool table.', exact: false });
  await expect(canvas).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await canvas.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByText('Shot power 50%')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(
    page.getByRole('button', { name: 'Shoot · Space' }),
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Shoot · Space' })).toBeEnabled(
    { timeout: 15000 },
  );
  await page.reload();
  await expect(canvas).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:game.sessions')!).pool.state
          .shots,
    ),
  ).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `node_modules/.cache/pool-${test.info().project.name}.png`,
  });
});
test('Pool resolves a legal 8-ball, removes the checkpoint and racks a rematch', async ({
  page,
}) => {
  await seed(page, eightFixture(true));
  await page.getByRole('button', { name: 'Shoot · Space' }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins!' }),
  ).toBeVisible({ timeout: 15000 });
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:game.sessions') ?? '{}').pool,
    ),
  ).toBeUndefined();
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1’s turn' }),
  ).toBeVisible();
});
test('Pool awards an early 8-ball to the other player', async ({ page }) => {
  await seed(page, eightFixture(false));
  await page.getByRole('button', { name: 'Shoot · Space' }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 2 wins!' }),
  ).toBeVisible({ timeout: 15000 });
});

test('Pool drag shoots and reload during motion restores the last stable table', async ({
  page,
}) => {
  await page.goto('/#/game/pool');
  await page.getByRole('button', { name: 'Start playing →' }).click();
  const canvas = page.getByRole('img', { name: 'Pool table.', exact: false });
  await canvas.scrollIntoViewIfNeeded();
  const rect = await canvas.boundingBox();
  if (!rect) throw Error('Pool table missing');
  await page.mouse.move(
    rect.x + rect.width * 0.265,
    rect.y + rect.height * 0.5,
  );
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width * 0.15,
    rect.y + rect.height * 0.5,
    { steps: 6 },
  );
  await page.mouse.up();
  await expect(
    page.getByRole('button', { name: 'Shoot · Space' }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Shoot · Space' }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:game.sessions')!).pool.state
          .shots,
    ),
  ).toBe(0);
  await page.getByText('Inspect balls').click();
  await expect(
    page.getByRole('listitem').filter({ hasText: '8-ball — on table' }),
  ).toBeVisible();
});
