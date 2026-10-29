import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
test.use({ serviceWorkers: 'allow' });
async function serverFixture() {
  const directory = 'node_modules/.cache/redesign-dist';
  const graph = JSON.parse(
    readFileSync(join(directory, 'offline-assets.json'), 'utf8'),
  ) as { version: string; assets: { path: string }[] };
  const allowed = new Set([
    ...graph.assets.map((a) => a.path),
    'offline-assets.json',
    'arcade-sw.js',
  ]);
  const worker = readFileSync(join(directory, 'arcade-sw.js'), 'utf8');
  const state = { version: graph.version, broken: false };
  const types: Record<string, string> = {
    js: 'text/javascript',
    mjs: 'text/javascript',
    css: 'text/css',
    html: 'text/html',
    json: 'application/json',
    jsonl: 'application/x-ndjson',
    svg: 'image/svg+xml',
    png: 'image/png',
    webp: 'image/webp',
    woff2: 'font/woff2',
    webmanifest: 'application/manifest+json',
  };
  const server = createServer((request, response) => {
    const path = new URL(request.url!, 'http://localhost').pathname;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Vary', 'Origin');
    if (request.headers.origin)
      response.setHeader('Access-Control-Allow-Origin', request.headers.origin);
    if (path === '/seed.html') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><title>Separate app fixture</title>');
      return;
    }
    if (path === '/foreign-sw.js') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end(
        "self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));",
      );
      return;
    }
    const prefix = path.startsWith('/a/')
      ? '/a/'
      : path.startsWith('/b/')
        ? '/b/'
        : null;
    const file = prefix ? path.slice(prefix.length) || 'index.html' : '';
    if (!prefix || !allowed.has(file)) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.setHeader(
      'Content-Type',
      types[file.split('.').pop()!] ?? 'application/octet-stream',
    );
    if (file === 'arcade-sw.js' && prefix === '/a/') {
      response.end(
        worker.replace(
          `"version":"${graph.version}"`,
          `"version":"${state.version}"`,
        ),
      );
      return;
    }
    if (
      state.broken &&
      prefix === '/a/' &&
      file.startsWith('assets/') &&
      file.endsWith('.js')
    ) {
      response.end('Incomplete deployment');
      return;
    }
    response.end(readFileSync(join(directory, file)));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    state,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

test('updates wait for consent, retain saved games/open tabs, isolate scopes and reject an incomplete deployment', async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  const server = await serverFixture();
  try {
    await page.goto(server.base + '/a/');
    await expect
      .poll(
        () =>
          page.evaluate(
            () => navigator.serviceWorker.controller?.scriptURL ?? '',
          ),
        { timeout: 30000 },
      )
      .toContain('/a/arcade-sw.js');
    const sibling = await context.newPage();
    await sibling.goto(server.base + '/b/');
    await expect
      .poll(
        () =>
          sibling.evaluate(
            () => navigator.serviceWorker.controller?.scriptURL ?? '',
          ),
        { timeout: 30000 },
      )
      .toContain('/b/arcade-sw.js');
    const openTab = await context.newPage();
    await openTab.goto(server.base + '/a/');
    await openTab.evaluate(() => {
      (window as unknown as { marker: number }).marker = 42;
    });
    await page.evaluate(async () => {
      const cache = await caches.open('other-app-cache');
      await cache.put('/other-app-data', new Response('keep me'));
      await caches.open(
        `arcade-redesign:${encodeURIComponent(location.origin + '/a/')}:incomplete`,
      );
    });
    await page.goto(server.base + '/a/#/game/tictactoe');
    await page.getByText('Match options & player names').click();
    await page.getByRole('button', { name: '2 players', exact: true }).click();
    await page.getByRole('button', { name: 'Start playing' }).click();
    await page.locator('.square').first().click();
    server.state.version = 'upgrade-v2';
    await page.getByText('Offline & install', { exact: true }).click();
    await page.getByRole('button', { name: 'Check offline updates' }).click();
    await expect(page.locator('.pwa-notice')).toBeVisible({ timeout: 30000 });
    expect(
      await page.evaluate(
        async () =>
          !!(await navigator.serviceWorker.getRegistration())?.waiting,
      ),
    ).toBe(true);
    await Promise.all([
      page.waitForEvent('domcontentloaded'),
      page
        .locator('.pwa-notice')
        .getByRole('button', { name: 'Update and reload' })
        .click(),
    ]);
    await expect(page.locator('.square').first()).toContainText('X');
    await expect
      .poll(() =>
        page.evaluate(async () =>
          (await caches.keys()).some((key) => key.endsWith(':upgrade-v2')),
        ),
      )
      .toBe(true);
    expect(
      await openTab.evaluate(
        () => (window as unknown as { marker: number }).marker,
      ),
    ).toBe(42);
    const cachesAfter = await page.evaluate(() => caches.keys());
    expect(cachesAfter).toContain('other-app-cache');
    expect(cachesAfter.some((key) => key.endsWith(':incomplete'))).toBe(false);
    expect(
      cachesAfter.filter((key) =>
        key.includes(encodeURIComponent(server.base + '/a/')),
      ),
    ).toHaveLength(2);
    expect(
      cachesAfter.some((key) =>
        key.includes(encodeURIComponent(server.base + '/b/')),
      ),
    ).toBe(true);
    server.state.version = 'broken-v3';
    server.state.broken = true;
    await page.getByText('Offline & install', { exact: true }).click();
    await page.getByRole('button', { name: 'Check offline updates' }).click();
    await expect(page.locator('.pwa-control')).toContainText(
      'offline download did not finish',
      { timeout: 30000 },
    );
    expect(
      await page.evaluate(async () =>
        (await caches.keys()).some((key) => key.endsWith(':broken-v3')),
      ),
    ).toBe(false);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.square').first()).toContainText('X');
    await context.setOffline(false);
  } finally {
    await server.close();
  }
});

test('a foreign production worker is preserved and never replaced by the redesign', async ({
  page,
}) => {
  const server = await serverFixture();
  try {
    await page.goto(server.base + '/seed.html');
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/foreign-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
    });
    await expect
      .poll(() =>
        page.evaluate(
          () => navigator.serviceWorker.controller?.scriptURL ?? '',
        ),
      )
      .toContain('/foreign-sw.js');
    await page.goto(server.base + '/a/');
    await page.getByText('Offline & install', { exact: true }).click();
    await expect(page.locator('.pwa-control')).toContainText(
      'Another app controls offline storage here',
    );
    const scripts = await page.evaluate(async () =>
      (await navigator.serviceWorker.getRegistrations()).map(
        (reg) => reg.active?.scriptURL,
      ),
    );
    expect(scripts).toEqual([server.base + '/foreign-sw.js']);
  } finally {
    await server.close();
  }
});
