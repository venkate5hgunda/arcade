import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
const manifest: { assets: { id: string; src: string; alt: string }[] } =
  JSON.parse(
    readFileSync(
      new URL('../../../docs/redesign/artwork-manifest.json', import.meta.url),
      'utf8',
    ),
  );
import { SUITS, RANKS, newBlackjack } from '../../src/lib/blackjack.ts';
import type { Card } from '../../src/lib/blackjack.ts';
const card = (rank: Card['rank'], suit: Card['suit'] = '♠'): Card => ({
  rank,
  suit,
});
async function seed(
  page: import('@playwright/test').Page,
  player: Card[],
  dealer: Card[],
  next: Card[] = [],
) {
  const used = [...player, ...dealer, ...next];
  const state = {
    player,
    dealer,
    deck: [
      ...SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank }))).filter(
        (c) => !used.some((u) => u.rank === c.rank && u.suit === c.suit),
      ),
      ...[...next].reverse(),
    ],
    result: null,
    doubled: false,
    round: 1,
    record: { wins: 0, losses: 0, pushes: 0, net: 0 },
    message: 'Your move.',
  };
  await page.goto('/');
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ blackjack: { state, savedAt: Date.now() } }),
      ),
    state,
  );
  await page.goto('/#/game/blackjack');
}
test('every game switches to its own local artwork, including catalog and details', async ({
  page,
}) => {
  await page.goto('/');
  for (const asset of manifest.assets) {
    await page
      .locator('.shelf-game')
      .filter({ has: page.locator(`img[src="${asset.src}"]`) })
      .click();
    const hero = page.locator('.hero-image');
    await expect(hero).toHaveAttribute('src', asset.src);
    await hero.evaluate((img: HTMLImageElement) => img.decode());
    expect(
      await hero.evaluate((img: HTMLImageElement) => img.naturalWidth),
    ).toBe(1344);
    await expect(hero).toHaveAttribute('alt', asset.alt);
    await expect(
      page.locator(`.game-card img[src="${asset.src}"]`),
    ).toHaveCount(1);
  }
  await page.goto('/#/game/chess');
  await expect(page.locator('.detail-art')).toHaveAttribute(
    'src',
    './art/games/chess.webp',
  );
  await page.goto('/#/game/blackjack');
  await expect(page.locator('.puzzle-setup-art')).toHaveAttribute(
    'src',
    './art/games/blackjack.webp',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('Blackjack restores a hand, keeps the dealer secret, settles and deals again', async ({
  page,
}) => {
  await seed(page, [card('10'), card('8')], [card('A'), card('6')]);
  await expect(
    page.getByRole('img', { name: 'Face-down dealer card' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: '6 of spades', exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Stand', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'You beat the dealer!' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: '6 of spades', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Session results')).toContainText('+1 units');
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:game.sessions') ?? '{}')
          .blackjack,
    ),
  ).toBeUndefined();
  // Keep this redeal active; initial naturals are covered separately below.
  const activeDeal = Array.from({ length: 999 }, (_, i) => (i + 1) / 1000).find(
    (value) => newBlackjack(undefined, () => value).result === null,
  );
  expect(activeDeal).toBeDefined();
  await page.evaluate((value) => {
    Math.random = () => value!;
  }, activeDeal);
  await page.getByRole('button', { name: 'Deal again' }).click();
  await expect(page.locator('.round-marker')).toContainText('Round 2');
  await expect(page.getByLabel('Session results')).toContainText('1 wins');
  const violations = (await new AxeBuilder({ page }).analyze()).violations;
  expect(violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('Blackjack double draws exactly once, hit removes double, busts and pushes finish', async ({
  page,
}) => {
  await seed(
    page,
    [card('5'), card('6')],
    [card('10'), card('7')],
    [card('K')],
  );
  await page.getByRole('button', { name: 'Double', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Session results')).toContainText('+2 units');
  await expect(
    page.getByRole('region', { name: 'Your hand' }).getByRole('img'),
  ).toHaveCount(3);
  await seed(
    page,
    [card('2'), card('3')],
    [card('10'), card('7')],
    [card('4'), card('K'), card('9')],
  );
  await page.getByRole('button', { name: 'Hit', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Double', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Hit', exact: true }).click();
  await page.getByRole('button', { name: 'Hit', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'The house takes this round.' }),
  ).toBeVisible();
  await seed(page, [card('10'), card('8')], [card('9'), card('9', '♥')]);
  await page.getByRole('button', { name: 'Stand', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'A push. Well played.' }),
  ).toBeVisible();
  await page.goto('/');
  await expect(
    page.locator('.continue-card[href="#/game/blackjack"]'),
  ).toHaveCount(0);
});

test('a natural on the initial deal settles immediately and is never offered as resumable', async ({
  page,
}) => {
  const value = Array.from({ length: 999 }, (_, i) => (i + 1) / 1000).find(
    (value) => newBlackjack(undefined, () => value).result === 'win',
  );
  expect(value).toBeDefined();
  await page.addInitScript((value) => {
    Math.random = () => value!;
  }, value);
  await page.goto('/#/game/blackjack');
  await page.getByRole('button', { name: 'Start playing' }).click();
  await expect(page.getByRole('status')).toContainText('Natural blackjack!');
  await expect(page.getByLabel('Session results')).toContainText('+1.5 units');
  await expect(
    page.getByRole('button', { name: 'Hit', exact: true }),
  ).toHaveCount(0);
  await page.goto('/');
  await expect(page.locator('.continue-card')).toHaveCount(0);
  await page.goto('/#/game/blackjack');
  await expect(
    page.getByRole('button', { name: 'Start playing' }),
  ).toBeVisible();
});
