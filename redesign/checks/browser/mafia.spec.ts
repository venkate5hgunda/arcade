import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const localIce = () => {
  Object.defineProperty(navigator, 'onLine', { get: () => false });
  const Native = window.RTCPeerConnection;
  window.RTCPeerConnection = class extends Native {
    setRemoteDescription(d: RTCSessionDescriptionInit) {
      return super.setRemoteDescription({
        ...d,
        sdp: d.sdp?.replace(
          /^(a=candidate:\S+ \d+ \S+ \d+ )\S+/gm,
          (_m, p) => p + '127.0.0.1',
        ),
      });
    }
  };
};
test('Mafia five-browser room protects roles, restores the host and resolves a complete game', async ({
  page: host,
  browser,
}) => {
  test.setTimeout(180000);
  await host.context().addInitScript(localIce);
  const contexts = await Promise.all(
    Array.from({ length: 4 }, () => browser.newContext()),
  );
  const guests: Page[] = [];
  for (const context of contexts) {
    await context.addInitScript(localIce);
    guests.push(await context.newPage());
  }
  const players = [host, ...guests],
    names = ['Mira', 'Kai1', 'Kai2', 'Kai3', 'Kai4'];
  async function connect(i: number, reconnect = false) {
    if (reconnect && i === 1)
      await host.getByText('Room players (5)', { exact: true }).click();
    if (reconnect)
      await host
        .getByRole('button', {
          name: 'Create reconnect invitation',
          exact: true,
        })
        .click();
    else if (i > 1)
      await host
        .getByRole('button', { name: 'Invite another player', exact: true })
        .click();
    await expect(host.getByLabel('Invitation to share')).toHaveValue(/invite=/);
    await players[i].goto(
      await host.getByLabel('Invitation to share').inputValue(),
    );
    await players[i].getByLabel('Your room name').fill(names[i]);
    await players[i]
      .getByRole('button', { name: 'Join room', exact: true })
      .click();
    await expect(players[i].getByLabel('Answer to share')).toHaveValue(
      /answer=/,
    );
    await host
      .getByLabel('Guest’s answer link')
      .fill(await players[i].getByLabel('Answer to share').inputValue());
    await host
      .getByRole('button', { name: 'Accept answer', exact: true })
      .click();
    await expect(
      host.getByLabel('Room players').getByText(names[i], { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await expect(
      host.getByLabel('Room players').getByText('Connected', { exact: true }),
    ).toHaveCount(i + 1, { timeout: 20000 });
  }
  try {
    await host.goto('/#/game/mafia');
    await host.getByRole('link', { name: 'Open private room →' }).click();
    await host.getByLabel('Your room name').fill(names[0]);
    await host
      .getByRole('button', { name: 'Create a room', exact: true })
      .click();
    for (let i = 1; i < 5; i++) {
      await connect(i);
      if (i === 1) {
        await expect(
          host.getByRole('button', { name: 'Start Mafia' }),
        ).toBeDisabled();
        await expect(
          host.getByText('Invite at least five players to start Mafia.'),
        ).toBeVisible();
      }
    }
    await host.getByLabel('Room game').selectOption('mafia');
    await host
      .getByRole('button', { name: 'Start Mafia', exact: true })
      .click();
    for (const p of players)
      await expect(p.locator('.mafia-role strong')).toBeVisible({
        timeout: 20000,
      });
    const roles = await Promise.all(
        players.map((p) => p.locator('.mafia-role strong').innerText()),
      ),
      spy = roles.indexOf('The Shadow'),
      doctor = roles.indexOf('The Guardian'),
      detective = roles.indexOf('The Oracle'),
      victim = roles.findIndex(
        (r, i) => r === 'The Lantern' && i !== doctor && i !== detective,
      );
    expect(spy).toBeGreaterThanOrEqual(0);
    expect(victim).toBeGreaterThanOrEqual(0);
    expect((await new AxeBuilder({ page: host }).analyze()).violations).toEqual(
      [],
    );
    for (let i = 0; i < 5; i++)
      await expect(players[i].locator('.mafia-role')).not.toContainText(
        roles.filter((_, j) => j !== i).join(', '),
      );
    await host.reload();
    await expect(
      host.getByText('Room restored.', { exact: false }),
    ).toBeVisible();
    for (let i = 1; i < 5; i++) await connect(i, true);
    for (let i = 0; i < 5; i++)
      await expect(players[i].locator('.mafia-role strong')).toHaveText(
        roles[i],
      );
    async function act(actor: number, target: number) {
      const p = players[actor];
      await p
        .getByRole('group', { name: 'Choose a player' })
        .getByRole('button', { name: `◇ ${names[target]} · ${target + 1}` })
        .click();
      await p.getByRole('button', { name: `Confirm ${names[target]}` }).click();
      await expect(
        p.getByRole('button', { name: `Confirm ${names[target]}` }),
      ).toHaveCount(0, { timeout: 20000 });
    }
    for (const actor of [spy, doctor, detective])
      await act(actor, actor === detective ? spy : victim);
    await expect(
      host.getByRole('button', { name: 'Reveal the dawn' }),
    ).toBeVisible({ timeout: 20000 });
    await host.getByRole('button', { name: 'Reveal the dawn' }).click();
    await players[detective].getByText('My private case file').click();
    await expect(
      players[detective].getByText(`Night 1: ${names[spy]} — Mafia.`),
    ).toBeVisible();
    for (let i = 0; i < 5; i++)
      if (i !== detective)
        await expect(players[i].getByText('My private case file')).toHaveCount(
          0,
        );
    await host
      .getByRole('button', { name: 'End discussion · open secret vote' })
      .click();
    for (let i = 0; i < 5; i++) {
      await expect(
        players[i].getByRole('group', { name: 'Choose a player' }),
      ).toBeVisible({ timeout: 20000 });
      await act(i, i === spy ? (spy === 0 ? 1 : 0) : spy);
    }
    await expect(
      host.getByRole('button', { name: 'Count the ballots' }),
    ).toBeVisible({ timeout: 20000 });
    await host.getByRole('button', { name: 'Count the ballots' }).click();
    for (const p of players)
      await expect(
        p.getByRole('heading', { name: 'The town prevails.' }),
      ).toBeVisible({ timeout: 20000 });
    await host.screenshot({
      path: `node_modules/.cache/mafia-${test.info().project.name}.png`,
    });
    await host.getByRole('button', { name: 'Deal another round' }).click();
    await expect(
      guests[0].getByRole('heading', { name: 'The city sleeps.' }),
    ).toBeVisible({ timeout: 20000 });
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

test('Mafia entry preselects the game and requires five players', async ({
  page,
}) => {
  await page.goto('/#/game/mafia');
  await page.getByRole('link', { name: 'Open private room →' }).click();
  await expect(page).toHaveURL(/game=mafia/);
  await expect(page.getByLabel('Invitation link')).toHaveValue('');
});
