import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { newHockey } from '../../src/lib/hockey.ts';
import type { HockeyState } from '../../src/lib/hockey.ts';
async function seed(page: Page, state: HockeyState) {
  await page.goto('/');
  await page.evaluate(
    (s) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ 'air-hockey': { state: s, savedAt: Date.now() } }),
      ),
    state,
  );
  await page.goto('/#/game/air-hockey');
}
test('Air Hockey starts at rest, responds to arrow keys and resumes the real puck', async ({
  page,
}) => {
  await page.goto('/#/game/air-hockey');
  await page.getByRole('button', { name: 'Start playing →' }).click();
  const canvas = page.getByLabel('Air hockey table.', { exact: false });
  await expect(canvas).toBeVisible();
  if (test.info().project.name === 'mobile') {
    const visible = await canvas.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight;
    });
    expect(visible).toBe(true);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await canvas.focus();
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(650);
  await page.keyboard.up('ArrowUp');
  await expect(
    page.getByRole('heading', { name: 'Puck in play!' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to the shelf' }).click();
  await expect(
    page.getByRole('heading', { name: 'Pick up where you left off' }),
  ).toBeVisible();
  await page.goto('/#/game/air-hockey');
  await expect(canvas).toBeVisible();
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('arcade:game.sessions')!)['air-hockey']
        .state,
  );
  expect(saved.openingFaceoff).toBe(false);
  expect(saved.paddles[0].y).toBeLessThan(700);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `node_modules/.cache/hockey-${test.info().project.name}.png`,
  });
});
test('Air Hockey scores, offers the other player a serve, finishes and rematches', async ({
  page,
}) => {
  let s = newHockey(5);
  s = { ...s, openingFaceoff: false, puck: { x: 300, y: 41, vx: 0, vy: -300 } };
  await seed(page, s);
  await expect(
    page.getByRole('heading', { name: 'Player 1 scores! · Player 2 serves' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Player 2 serves' }),
  ).toBeVisible();
  s = {
    ...newHockey(5),
    paddles: [
      { x: 300, y: 740, score: 4 },
      { x: 300, y: 160, score: 0 },
    ],
    openingFaceoff: false,
    puck: { x: 300, y: 41, vx: 0, vy: -300 },
  };
  await seed(page, s);
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins!' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:game.sessions') ?? '{}')[
          'air-hockey'
        ],
    ),
  ).toBeUndefined();
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(
    page.getByRole('heading', { name: 'Faceoff · strike the puck to start' }),
  ).toBeVisible();
});

test('Air Hockey supports dragging a paddle with a pointer', async ({
  page,
}) => {
  await page.goto('/#/game/air-hockey');
  await page.getByRole('button', { name: 'Start playing →' }).click();
  const canvas = page.getByLabel('Air hockey table.', { exact: false });
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw Error('Missing hockey table');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.82);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.53, {
    steps: 12,
  });
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect(
    page.getByRole('heading', { name: 'Puck in play!' }),
  ).toBeVisible();
});

test('Air Hockey reset clears the checkpoint without a disposed table recreating it', async ({
  page,
}) => {
  await page.goto('/#/game/air-hockey');
  await page.getByRole('button', { name: 'Start playing →' }).click();
  await expect(
    page.getByLabel('Air hockey table.', { exact: false }),
  ).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Start playing →' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:game.sessions') ?? '{}')[
          'air-hockey'
        ],
    ),
  ).toBeUndefined();
});
