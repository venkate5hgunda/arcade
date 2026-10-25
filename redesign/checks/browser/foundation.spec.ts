import { test, expect } from '@playwright/test';
import baseline from '../../../docs/redesign/parity.json' with { type: 'json' };
const entries = baseline.requirements;
test('catalog imports the complete baseline and filters through real UI', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.card')).toHaveCount(entries.length);
  const category = entries[0].category;
  await page.getByRole('button', { name: category, exact: true }).click();
  await expect(page.locator('.card')).toHaveCount(
    entries.filter((e) => e.category === category).length,
  );
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByRole('searchbox').fill(entries[0].title);
  await expect(page.locator('.card')).toHaveCount(1);
  await page.locator('.card').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    entries[0].title,
  );
  for (const text of entries[0].acceptance)
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    entries[0].title,
  );
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Explore the redesign' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('all requirement routes are reachable and carry their acceptance criteria', async ({
  page,
}) => {
  for (const entry of entries) {
    await page.goto(`/#/requirements/${entry.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      entry.title,
    );
    await expect(
      page.getByText(entry.acceptance[0], { exact: true }),
    ).toBeVisible();
  }
});
test('empty search and unknown route give usable recovery', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('searchbox').fill('zzzz-no-match');
  await expect(page.locator('.card')).toHaveCount(0);
  await expect(page.getByText(/No features match/)).toBeVisible();
  await page.goto('/#/requirements/missing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Feature not found',
  );
  await page.getByRole('link', { name: 'Back to all features' }).click();
  await expect(page.locator('.card')).toHaveCount(entries.length);
});
test('preview is responsive, keyboard navigable and isolated from production data', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:')) external.push(r.url());
  });
  await page.goto('/');
  await expect(page.locator('.card')).toHaveCount(entries.length);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('searchbox').focus();
  await page.keyboard.type(entries[0].title);
  await expect(page.locator('.card')).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  expect(
    await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistrations()).length,
    ),
  ).toBe(0);
  expect(
    await page.evaluate(async () => (await indexedDB.databases()).length),
  ).toBe(0);
  expect(external).toEqual([]);
});

test('catalog and detail meet automated accessibility checks', async ({
  page,
}) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  for (const path of ['/', `/#/requirements/${entries[0].id}`]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  }
});
