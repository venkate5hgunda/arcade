import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { GAMES } from '../../src/lib/games.ts';

test('clean game surfaces retain contrast and fit a phone viewport', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  const findings: unknown[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const game of GAMES) {
    await page.goto(`/#/game/${game.id}`);
    const start = page.getByRole('button', {
      name: /^Start playing/,
    });
    if (await start.count()) await start.click();
    await expect(
      page.getByRole('heading', { name: game.name, level: 1, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      game.id,
    ).toBe(true);
    const violations = (await new AxeBuilder({ page }).analyze()).violations;
    if (violations.length) findings.push({ game: game.id, violations });
    if (
      [
        'strands',
        'wordle',
        'blackjack',
        'snakes-ladders',
        'spelling-bee',
      ].includes(game.id)
    )
      await page.screenshot({
        path: `node_modules/.cache/editorial-${game.id}.png`,
        fullPage: true,
      });
  }
  expect(findings).toEqual([]);
  expect(errors).toEqual([]);
});

test('game menu contains help, traps focus, dismisses with Escape and restores focus', async ({
  page,
}) => {
  await page.goto('/#/game/strands');
  await page.getByRole('button', { name: /^Start playing/ }).click();
  const menu = page.getByRole('button', { name: 'Game menu', exact: true });
  await menu.click();
  const dialog = page.getByRole('dialog', { name: 'Game menu', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByText('How to play', { exact: true }).click();
  await expect(dialog.locator('details')).toHaveAttribute('open', '');
  await page.keyboard.press('Tab');
  expect(
    await page.evaluate(() => !!document.activeElement?.closest('dialog')),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(menu).toBeFocused();
  await menu.click();
  await dialog.getByRole('button', { name: 'Close menu' }).click();
  await expect(menu).toBeFocused();
});
