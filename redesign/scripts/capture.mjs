import { chromium, webkit, devices } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
const port = 5174;
const server =
  process.env.ARCADE_REUSE_PREVIEW === '1'
    ? null
    : spawn(
        process.execPath,
        ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1'],
        { stdio: 'ignore' },
      );
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server && server.exitCode !== null)
      throw new Error('Preview server stopped');
    try {
      ready = (await fetch(`http://127.0.0.1:${port}`)).ok;
    } catch {}
    if (ready) break;
    await setTimeout(250);
  }
  if (!ready) throw new Error('Preview server did not start');
  await mkdir('../docs/images', { recursive: true });
  for (const [name, type, options] of [
    ['desktop', chromium, { viewport: { width: 1440, height: 1024 } }],
    ['mobile', webkit, devices['iPhone 13']],
  ]) {
    const browser = await type.launch();
    try {
      const page = await browser.newPage({
        ...options,
        reducedMotion: 'reduce',
      });
      await page.goto(`http://127.0.0.1:${port}`);
      await page.locator('.game-card').first().waitFor();
      await page.locator('img').evaluateAll(async (images) => {
        await Promise.all(
          images
            .filter((img) => {
              const rect = img.getBoundingClientRect();
              return (
                rect.bottom > 0 &&
                rect.top < innerHeight &&
                rect.right > 0 &&
                rect.left < innerWidth
              );
            })
            .map((img) => img.decode()),
        );
        await document.fonts.ready;
      });
      await page.screenshot({ path: `../docs/images/redesign-${name}.png` });
      await page.goto(`http://127.0.0.1:${port}/#/game/blackjack`);
      await page.getByRole('button', { name: 'Start playing' }).click();
      await page.locator('.blackjack-table').waitFor();
      await page.screenshot({
        path: `../docs/images/redesign-blackjack-${name}.png`,
        fullPage: true,
      });
      for (const id of ['crazy-eights', 'uno']) {
        await page.goto(`http://127.0.0.1:${port}/#/game/${id}`);
        await page.getByRole('button', { name: 'Start playing' }).click();
        await page.getByRole('button', { name: 'Reveal my hand' }).click();
        await page.screenshot({
          path: `../docs/images/redesign-${id}-${name}.png`,
          fullPage: true,
        });
      }
    } finally {
      await browser.close();
    }
  }
  console.log('Captured desktop and mobile shelf previews.');
} finally {
  server?.kill();
}
