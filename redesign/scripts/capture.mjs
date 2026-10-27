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
      await page.locator('.hero-image').evaluate(async (el) => {
        const url = getComputedStyle(el).backgroundImage.slice(5, -2);
        const image = new Image();
        image.src = url;
        await image.decode();
      });
      await page.screenshot({ path: `../docs/images/redesign-${name}.png` });
    } finally {
      await browser.close();
    }
  }
  console.log('Captured desktop and mobile shelf previews.');
} finally {
  server?.kill();
}
