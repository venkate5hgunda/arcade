import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { GAMES } from '../../src/lib/games.ts';
test.use({ serviceWorkers: 'allow' });
async function ready(page: Page) {
  await page.goto('/');
  await expect
    .poll(
      () =>
        page.evaluate(
          () => navigator.serviceWorker.controller?.scriptURL ?? '',
        ),
      { timeout: 30000 },
    )
    .toContain('/arcade-sw.js');
}

test('verified offline assets cover all games, artwork, QR and approved movie files', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(90000);
  await ready(page);
  await expect(page.locator('.pwa-notice')).toHaveCount(0);
  const graph = (await page.evaluate(async () =>
    (await fetch('./offline-assets.json')).json(),
  )) as { version: string; assets: { path: string; sha256: string }[] };
  expect(graph.assets.some((a) => a.path === 'manifest.webmanifest')).toBe(
    true,
  );
  expect(
    graph.assets.some((a) => a.path === 'vendor/qr-scanner-worker.min.js'),
  ).toBe(true);
  expect(graph.assets.some((a) => a.path.endsWith('.jsonl'))).toBe(true);
  const manifest = await page.evaluate(async () =>
    (await fetch('./manifest.webmanifest')).json(),
  );
  expect(manifest.display).toBe('standalone');
  expect(manifest.scope).toBe('./');
  expect(manifest.start_url).toBe('./');
  expect(manifest.icons).toHaveLength(4);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.game-card')).toHaveCount(26);
  const unavailable = await page.evaluate(async (assets) => {
    const results = await Promise.all(
      assets.map(async ({ path }) => {
        try {
          return (await fetch(new URL(path, document.baseURI))).ok
            ? null
            : path;
        } catch {
          return path;
        }
      }),
    );
    return results.filter(Boolean);
  }, graph.assets);
  expect(unavailable).toEqual([]);
  for (const game of GAMES) {
    await page.goto(`/#/game/${game.id}`);
    await expect(
      page.getByRole('heading', { name: game.name, exact: true, level: 1 }),
    ).toBeVisible();
  }
  await page.goto('/#/game/tictactoe');
  await page.getByText('Match options & player names').click();
  await page.getByRole('button', { name: '2 players', exact: true }).click();
  await page.getByRole('button', { name: 'Start playing' }).click();
  for (const cell of [0, 3, 1, 4, 2])
    await page.locator('.square').nth(cell).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 wins!' }),
  ).toBeVisible();
  await page.getByText('Offline & install', { exact: true }).click();
  await expect(page.locator('.pwa-control')).toContainText(/offline/i);
  await page.screenshot({
    path: testInfo.outputPath('offline-game.png'),
    fullPage: true,
  });
  await context.setOffline(false);
});

test('cache failures keep gameplay available and explain retry', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = navigator.serviceWorker.register.bind(
      navigator.serviceWorker,
    );
    navigator.serviceWorker.register = () =>
      Promise.reject(new DOMException('Storage is full', 'QuotaExceededError'));
    void original;
  });
  await page.goto('/#/game/tictactoe');
  await page.getByRole('button', { name: 'Start playing' }).click();
  await page.getByText('Offline & install', { exact: true }).click();
  await expect(page.locator('.pwa-control')).toContainText(
    'Offline storage is unavailable',
  );
  await page.locator('.square').first().click();
  await expect(page.locator('.square').first()).toContainText('X');
});

test('standalone mode and browser install acceptance/cancellation are reported truthfully', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByText('Offline & install', { exact: true }).click();
  const offer = async (outcome: 'accepted' | 'dismissed') =>
    page.evaluate((outcome) => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.assign(event, {
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome }),
      });
      window.dispatchEvent(event);
    }, outcome);
  await offer('dismissed');
  await page
    .getByRole('button', { name: 'Install Arcade', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Install Arcade', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.pwa-control')).not.toContainText(
    'Running as an installed app.',
  );
  await offer('accepted');
  await page
    .getByRole('button', { name: 'Install Arcade', exact: true })
    .click();
  await expect(page.locator('.pwa-control')).toContainText(
    'Installation requested.',
  );
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(page.locator('.pwa-control')).toContainText(
    'Running as an installed app.',
  );
  await page.addInitScript(() => {
    const match = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const result = match(query);
      if (query === '(display-mode: standalone)')
        Object.defineProperty(result, 'matches', { value: true });
      return result;
    };
  });
  await page.reload();
  await page.getByText('Offline & install', { exact: true }).click();
  await expect(page.locator('.pwa-control')).toContainText(
    'Running as an installed app.',
  );
});
