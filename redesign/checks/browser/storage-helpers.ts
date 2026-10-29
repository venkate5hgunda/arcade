import { expect, type Page } from '@playwright/test';
/** Await the production lock queue before inspecting a checkpoint or testing reload. */
export async function settleStorage(page: Page) {
  await page.evaluate(async () => {
    if (navigator.locks)
      await navigator.locks.request('arcade:game.sessions', () => undefined);
  });
  await expect(page.locator('.board-panel[aria-busy="true"]')).toHaveCount(0);
}
