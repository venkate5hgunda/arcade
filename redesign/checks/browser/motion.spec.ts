import { settleStorage } from './storage-helpers.ts';
import { test, expect } from '@playwright/test';
import { newRace } from '../../src/lib/races.ts';
import { GAMES } from '../../src/lib/games.ts';
import type { SimonState } from '../../src/lib/puzzles.ts';

test('every native game surface disables CSS animation and transitions with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const game of GAMES) {
    await page.goto(`/#/game/${game.id}`);
    await expect(
      page.getByRole('heading', { name: game.name, exact: true, level: 1 }),
    ).toBeVisible();
    const start = page.getByRole('button', {
      name: 'Start playing',
      exact: true,
    });
    if (await start.count()) await start.click();
    await expect(page.locator('main')).toBeVisible();
    const animated = await page.locator('main').evaluate((main) =>
      Array.from(main.querySelectorAll('*'))
        .filter((element) => {
          const style = getComputedStyle(element);
          return (
            style.animationName !== 'none' ||
            style.transitionDuration
              .split(',')
              .some((duration) => parseFloat(duration) !== 0)
          );
        })
        .map((element) => element.className),
    );
    expect(animated, game.id).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      game.id,
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('a live reduced-motion change settles race travel and releases the next turn', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const original = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = ((array: ArrayBufferView) => {
      if (array instanceof Uint32Array && array.length === 1) {
        array[0] = 0xffffffff;
        return array;
      }
      return original(array as Uint8Array);
    }) as typeof crypto.getRandomValues;
  });
  const game = newRace('snakes-ladders', 2, 'demo');
  if (game.gameId !== 'snakes-ladders') throw Error('wrong game');
  game.state.positions[0] = 40;
  await page.goto('/');
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({
          'snakes-ladders': { state, savedAt: Date.now() },
        }),
      ),
    game.state,
  );
  await page.goto('/#/game/snakes-ladders');
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  await page.getByRole('button', { name: 'Roll die' }).click();
  await expect(
    page.getByRole('heading', { name: 'Player 1 is moving…' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Roll die' })).toBeDisabled();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByLabel('Player 1 on square 46')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Player 2’s turn' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Roll die' })).toBeEnabled();
  await page.clock.runFor(2000);
  await expect(page.getByLabel('Player 1 on square 46')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Player 1 on square 46')).toBeVisible();
});

test('2048 cancels active travel and still completes a win, continuation and recovery', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'arcade:game.sessions',
      JSON.stringify({
        '2048': {
          state: {
            grid: [
              [1024, 1024, 0, 0],
              [2, 0, 0, 0],
              [0, 0, 0, 0],
              [0, 0, 0, 0],
            ],
            score: 0,
            won: false,
            keepPlaying: false,
          },
          savedAt: Date.now(),
        },
      }),
    ),
  );
  await page.goto('/#/game/2048');
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  await page.getByRole('button', { name: 'Move left', exact: true }).click();
  await expect(page.locator('.tile-motion-layer')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.tile-motion-layer')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'You reached 2048!' }),
  ).toBeVisible();
  expect(
    await page
      .locator('.tile-merged')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
  await page.getByRole('button', { name: 'Keep going' }).click();
  await page.getByRole('button', { name: 'Move right', exact: true }).click();
  await expect(page.locator('.tile-motion-layer')).toHaveCount(0);
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('arcade:game.sessions')!)['2048'].state,
  );
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Slide. Merge. Repeat.' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:game.sessions')!)['2048'].state,
    ),
  ).toEqual(saved);
});

test('reduced motion preserves Simon sequence timing and outline cues without pad movement', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Math.random = () => 0.1;
  });
  await page.goto('/#/game/simon');
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  await page.getByRole('button', { name: 'Start playing' }).click();
  await settleStorage(page);
  await expect(
    page.getByRole('heading', { name: 'Watch the sequence.' }),
  ).toBeVisible();
  await page.clock.runFor(600);
  const pad = page.locator('.simon-pad.active');
  await expect(pad).toHaveCount(1);
  expect(
    await pad.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        transform: style.transform,
        outline: style.outlineStyle,
        transition: style.transitionDuration,
      };
    }),
  ).toEqual({ transform: 'none', outline: 'solid', transition: '0s' });
  await page.screenshot({
    path: testInfo.outputPath('simon-reduced-motion.png'),
  });
  await page.clock.runFor(1500);
  await expect(
    page.getByRole('heading', { name: 'Your turn — repeat it.' }),
  ).toBeVisible();
  const state: SimonState = await page.evaluate(
    () => JSON.parse(localStorage.getItem('arcade:game.sessions')!).simon.state,
  );
  await page
    .locator('.simon-pad')
    .nth((state.sequence[0] + 1) % 4)
    .click();
  await expect(
    page.getByRole('heading', { name: 'Game over — reached round 1' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Play again' }).click();
  await settleStorage(page);
  await expect(
    page.getByRole('heading', { name: 'Watch the sequence.' }),
  ).toBeVisible();
});

test('reduced motion removes interactive hover travel while keeping game controls usable', async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const card = page.locator('.game-card').first();
  if (!isMobile) await card.hover();
  expect(await card.evaluate((el) => getComputedStyle(el).transform)).toBe(
    'none',
  );
  await page.goto('/#/game/tictactoe');
  await page.getByRole('button', { name: 'Start playing' }).click();
  await settleStorage(page);
  const square = page.getByRole('button', { name: 'Row 1, column 1: empty' });
  if (!isMobile) await square.hover();
  expect(await square.evaluate((el) => getComputedStyle(el).transform)).toBe(
    'none',
  );
  await square.click();
  await expect(
    page.getByRole('button', { name: 'Row 1, column 1: X' }),
  ).toBeVisible();
  await page.goto('/#/game/rps');
  await page.getByRole('button', { name: 'Start playing' }).click();
  await settleStorage(page);
  const choice = page.locator('.rps-choices button').first();
  if (!isMobile) await choice.hover();
  expect(await choice.evaluate((el) => getComputedStyle(el).transform)).toBe(
    'none',
  );
  await choice.click();
  await expect(page.locator('.rps-choices')).toBeHidden();
});
