import { test, expect } from '@playwright/test';

test('theme follows the device in auto mode and preserves explicit choices', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(
    page.getByRole('button', { name: 'Theme: auto. Select light' }),
  ).toBeVisible();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    '#fff8eb',
  );
  await page.getByRole('button', { name: 'Theme: auto. Select light' }).click();
  await page.getByRole('button', { name: 'Theme: light. Select dark' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(
    page.getByRole('button', { name: 'Theme: dark. Select auto' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Theme: dark. Select auto' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('arcade:ui.theme')!),
    ),
  ).toBe('auto');
});

test('invalid saved theme falls back to the device preference', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem('arcade:ui.theme', JSON.stringify('unknown')),
  );
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Theme: auto. Select light' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
