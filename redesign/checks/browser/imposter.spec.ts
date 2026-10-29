import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { newImposter } from '../../src/lib/imposter.ts';
import type { ImposterState } from '../../src/lib/imposter.ts';
async function seed(page: Page, s: ImposterState | object) {
  await page.goto('/');
  await page.evaluate(
    (s) =>
      localStorage.setItem(
        'arcade:game.sessions',
        JSON.stringify({ imposter: { state: s, savedAt: Date.now() } }),
      ),
    s,
  );
  await page.goto('/#/game/imposter');
}
test('Classic Imposter covers each card and ballot, catches a spy and replays', async ({
  page,
}) => {
  const s = newImposter(
    4,
    'classic',
    [1, 1],
    ['category', 'hint', 'team'],
    ['food'],
    {},
    [],
    () => 0,
  );
  const spy = s.imposters[0];
  await seed(page, s);
  await expect(page.getByText(s.word, { exact: true })).toHaveCount(0);
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Show my card' }).click();
    await expect(page.locator('.imposter-card')).toContainText(
      i === spy ? 'You are an imposter' : s.word,
    );
    if (i === 0) {
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.reload();
      await expect(page.locator('.imposter-card')).toHaveCount(0);
      await page.getByRole('button', { name: 'Show my card' }).click();
    }
    await page
      .getByRole('button', {
        name: i === 3 ? 'Hide & start discussion' : 'Hide & pass on',
      })
      .click();
    await expect(page.locator('.imposter-card')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Start voting' }).click();
  for (let i = 0; i < 4; i++) {
    await expect(
      page.getByRole('group', { name: 'Choose a suspect' }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Open my ballot' }).click();
    const suspect = page
      .getByRole('group', { name: 'Choose a suspect' })
      .getByRole('button', {
        name: `Player ${i === spy ? (spy === 0 ? 2 : 1) : spy + 1}`,
        exact: true,
      });
    await suspect.click();
    await expect(suspect).toHaveAttribute('aria-pressed', 'true');
    if (i === 0) {
      await page.reload();
      await expect(
        page.getByRole('group', { name: 'Choose a suspect' }),
      ).toHaveCount(0);
      await page.getByRole('button', { name: 'Open my ballot' }).click();
      await expect(
        page.getByRole('button', { name: 'Lock in vote' }),
      ).toBeEnabled();
    }
    await page.getByRole('button', { name: 'Lock in vote' }).click();
  }
  await expect(
    page.getByRole('heading', { name: 'The crew caught every imposter!' }),
  ).toBeVisible();
  await expect(
    page.getByText(`The word was ${s.word}`, { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('arcade:game.sessions') ?? '{}')
          .imposter,
    ),
  ).toBeUndefined();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `node_modules/.cache/imposter-${test.info().project.name}.png`,
  });
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.locator('.imposter-card')).toHaveCount(0);
});
test('Pair mode shows the decoy without revealing the role and hides cards on background', async ({
  page,
}) => {
  const s = newImposter(4, 'pair', [1, 1], [], ['food'], {}, [], () => 0);
  await seed(page, s);
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Show my card' }).click();
    await expect(page.locator('.imposter-card')).toContainText(
      i === s.imposters[0] ? s.decoy : s.word,
    );
    await expect(page.locator('.imposter-card')).not.toContainText('imposter');
    if (i === 0) {
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', {
          value: true,
          configurable: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await expect(page.locator('.imposter-card')).toHaveCount(0);
      await page.getByRole('button', { name: 'Show my card' }).click();
    }
    await page
      .getByRole('button', {
        name: i === 3 ? 'Hide & start discussion' : 'Hide & pass on',
      })
      .click();
  }
  await expect(page.getByRole('heading', { name: 'Discussion' })).toBeVisible();
});
test('legacy Imposter resumes covered and movie settings deal pair words', async ({
  page,
}) => {
  await seed(page, {
    players: 4,
    imposterIndex: 1,
    word: 'COFFEE',
    clue: 'Hot drink',
    phase: 'reveal',
    currentPlayer: 0,
    votes: [null, null, null, null],
  });
  await expect(page.locator('.imposter-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show my card' }).click();
  await expect(page.locator('.imposter-card')).toContainText('COFFEE');
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await page.getByText('Match options', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Mode' }).selectOption('pair');
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.getByLabel('🎬 Telugu movies').check();
  await page.getByLabel('From year').fill('2024');
  await page.getByLabel('To year').fill('2024');
  await page.getByRole('button', { name: 'Start playing →' }).click();
  await page.getByRole('button', { name: 'Show my card' }).click();
  await expect(page.locator('.imposter-card')).toContainText('(2024)');
});
