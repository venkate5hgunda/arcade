import { expect, test } from '@playwright/test';

test('the mobile top bar stays reachable during play and after leaving', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'The compact top bar sticks on small screens.');
  await page.goto('/#/game/tictactoe');
  await page.getByRole('button', { name: 'Start playing' }).tap();
  await page.getByRole('button', { name: 'Row 1, column 1: empty' }).tap();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);

  const home = page.getByRole('link', { name: 'Arcade home' });
  await expect(home).toBeInViewport();
  await page.getByRole('button', { name: 'Theme: auto. Select light' }).tap();
  await expect(
    page.getByRole('button', { name: 'Theme: light. Select dark' }),
  ).toBeInViewport();
  await home.tap();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Tic-Tac-Toe',
  );
  await expect(home).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.getByRole('searchbox', { name: 'Search games' }).tap();
  await page.getByRole('searchbox', { name: 'Search games' }).fill('Pool');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '8-Ball Pool',
  );
  await expect(
    page.getByRole('searchbox', { name: 'Search games' }),
  ).toBeFocused();
});

test('Pool shortcuts leave keyboard navigation available outside the table', async ({
  page,
}) => {
  await page.goto('/#/game/pool');
  await page.getByRole('button', { name: 'Start playing' }).click();
  await expect(page.locator('canvas')).toBeVisible();

  const exit = page.getByRole('link', { name: 'Back to the shelf' });
  await exit.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('link', { name: 'Arcade home' })).toBeFocused();
  await expect(page).toHaveURL(/#\/$/);
});
