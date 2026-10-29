import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
type CameraTestWindow = Window & {
  finishCameraStart(): void;
  roomQrCallback(value: { data: string }): void;
  roomQrDestroyed: boolean;
};
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
const fakeCamera = () => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: async () => ({}) },
  });
};
const scannerStub = `export default class Scanner { constructor(_video, callback) { globalThis.roomQrCallback = callback; } async start() {} destroy() { globalThis.roomQrDestroyed = (globalThis.roomQrDestroyed || 0) + 1; } }`;
test('room QR round-trips the actual invitation and scans both sides of a real connection', async ({
  page: host,
  browser,
}, testInfo) => {
  test.setTimeout(90000);
  await host.context().addInitScript(localIce);
  await host.context().addInitScript(fakeCamera);
  const context = await browser.newContext();
  await context.addInitScript(localIce);
  await context.addInitScript(fakeCamera);
  const guest = await context.newPage();
  try {
    await host.goto('/#/room');
    await host.getByLabel('Your room name').fill('Mira');
    await host
      .getByRole('button', { name: 'Create a room', exact: true })
      .click();
    const invitation = host.getByLabel('Invitation to share');
    await expect(invitation).toHaveValue(/invite=/);
    const invite = await invitation.inputValue();
    await host.getByText('QR code', { exact: true }).click();
    const image = host.getByRole('img', {
      name: 'QR code for invitation link',
    });
    await expect(image).toBeVisible();
    expect(
      await host.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page: host }).analyze()).violations).toEqual(
      [],
    );
    await host.screenshot({
      path: testInfo.outputPath('room-qr.png'),
      fullPage: true,
    });
    const decoderContext = await browser.newContext();
    const decoder = await decoderContext.newPage();
    await decoder.goto('/');
    const source = await image.getAttribute('src');
    const decoded = await decoder.evaluate(async (source) => {
      const img = new Image();
      img.src = source!;
      await img.decode();
      const path = new URL('./vendor/qr-scanner.min.js', document.baseURI).href;
      const scanner = (await import(/* @vite-ignore */ path)).default;
      return (await scanner.scanImage(img, { returnDetailedScanResult: true }))
        .data as string;
    }, source);
    await decoderContext.close();
    expect(decoded).toBe(invite);
    await context.route('**/vendor/qr-scanner.min.js', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: scannerStub,
      }),
    );
    await host.context().route('**/vendor/qr-scanner.min.js', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: scannerStub,
      }),
    );
    await guest.goto('/#/room');
    await guest.getByLabel('Your room name').fill('Kai');
    await guest.getByRole('button', { name: 'Scan invitation QR' }).click();
    await expect(guest.getByLabel('QR camera preview')).toBeVisible();
    await expect
      .poll(() =>
        guest.evaluate(
          () =>
            typeof (window as unknown as { roomQrCallback?: unknown })
              .roomQrCallback,
        ),
      )
      .toBe('function');
    await guest.evaluate(() =>
      (
        window as unknown as { roomQrCallback: (v: { data: string }) => void }
      ).roomQrCallback({ data: 'not a room link' }),
    );
    await expect(guest.getByText(/Invalid invitation link/)).toBeVisible();
    await guest.evaluate(
      (data) =>
        (
          window as unknown as { roomQrCallback: (v: { data: string }) => void }
        ).roomQrCallback({ data }),
      invite,
    );
    await expect(guest.getByLabel('Invitation link')).toHaveValue(invite);
    await expect(guest.getByLabel('QR camera preview')).toHaveCount(0);
    expect(
      await guest.evaluate(
        () =>
          (window as unknown as { roomQrDestroyed: number }).roomQrDestroyed,
      ),
    ).toBeGreaterThan(0);
    await guest.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(guest.getByLabel('Answer to share')).toHaveValue(/answer=/);
    const answer = await guest.getByLabel('Answer to share').inputValue();
    await host.getByRole('button', { name: 'Scan answer QR' }).click();
    await expect
      .poll(() =>
        host.evaluate(
          () =>
            typeof (window as unknown as { roomQrCallback?: unknown })
              .roomQrCallback,
        ),
      )
      .toBe('function');
    await host.evaluate(
      (data) =>
        (
          window as unknown as { roomQrCallback: (v: { data: string }) => void }
        ).roomQrCallback({ data }),
      answer,
    );
    await expect(host.getByLabel('Guest’s answer link')).toHaveValue(answer);
    await host.getByRole('button', { name: 'Accept answer' }).click();
    await expect(
      host.getByLabel('Room players').getByText('Connected', { exact: true }),
    ).toHaveCount(2, { timeout: 20000 });
    await host
      .getByRole('button', { name: 'Start Tic-Tac-Toe', exact: true })
      .click();
    for (const [player, cell] of [
      [host, 0],
      [guest, 3],
      [host, 1],
      [guest, 4],
      [host, 2],
    ] as const) {
      await expect(
        player.getByRole('heading', { name: 'Your turn', exact: true }),
      ).toBeVisible();
      await player.locator('.square').nth(cell).click();
    }
    for (const player of [host, guest])
      await expect(
        player.getByRole('heading', { name: 'Mira wins!' }),
      ).toBeVisible();
  } finally {
    await context.close();
  }
});

test('cancelling a pending camera start releases the scanner and ignores late results', async ({
  page,
}) => {
  await page.addInitScript(fakeCamera);
  await page.route('**/vendor/qr-scanner.min.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `export default class Scanner {
      constructor(_video, callback) { globalThis.roomQrCallback = callback; }
      start() { return new Promise(resolve => { globalThis.finishCameraStart = resolve; }); }
      destroy() { globalThis.roomQrDestroyed = true; }
    }`,
    }),
  );
  await page.goto('/#/room');
  await page.getByRole('button', { name: 'Scan invitation QR' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => typeof (window as unknown as CameraTestWindow).finishCameraStart,
      ),
    )
    .toBe('function');
  await page.getByRole('button', { name: 'Cancel scan' }).click();
  await page.evaluate(() => {
    (window as unknown as CameraTestWindow).finishCameraStart();
    (window as unknown as CameraTestWindow).roomQrCallback({
      data: 'late invalid result',
    });
  });
  await expect(page.getByLabel('QR camera preview')).toHaveCount(0);
  await expect(page.getByLabel('Invitation link')).toHaveValue('');
  await expect(page.getByText(/Invalid invitation link/)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as CameraTestWindow).roomQrDestroyed,
    ),
  ).toBe(true);
});

test('failed native sharing and clipboard access select the raw link for manual copying', async ({
  page,
}) => {
  await page.addInitScript(localIce);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => {
        throw new Error('Share unavailable');
      },
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('Clipboard denied');
        },
      },
    });
  });
  await page.goto('/#/room');
  await page.getByLabel('Your room name').fill('Mira');
  await page
    .getByRole('button', { name: 'Create a room', exact: true })
    .click();
  await page.getByRole('button', { name: 'Share link' }).click();
  await expect(
    page.getByText('Clipboard unavailable. Copy the selected link manually.'),
  ).toBeVisible();
  const field = page.getByLabel('Invitation to share');
  await expect(field).toBeFocused();
  expect(
    await field.evaluate(
      (el: HTMLTextAreaElement) =>
        el.selectionStart === 0 && el.selectionEnd === el.value.length,
    ),
  ).toBe(true);
});

test('camera denial provides a paste-link fallback', async ({ page }) => {
  await page.addInitScript(fakeCamera);
  await page.route('**/vendor/qr-scanner.min.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `export default class Scanner { async start() { throw new Error('Permission denied'); } destroy() {} }`,
    }),
  );
  await page.goto('/#/room');
  await page.getByRole('button', { name: 'Scan invitation QR' }).click();
  await expect(
    page.getByText(/Permission denied.*paste the link/),
  ).toBeVisible();
  await expect(page.getByLabel('Invitation link')).toBeVisible();
});

test('oversized QR output leaves the raw invitation available', async ({
  page,
}) => {
  await page.addInitScript(localIce);
  await page.route('**/vendor/qrcode.mjs', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `export default () => ({ addData() {}, make() { throw new Error('code length overflow'); } });`,
    }),
  );
  await page.goto('/#/room');
  await page.getByLabel('Your room name').fill('Mira');
  await page
    .getByRole('button', { name: 'Create a room', exact: true })
    .click();
  await page.getByText('QR code', { exact: true }).click();
  await expect(page.getByText(/too long for one QR code/)).toBeVisible();
  await expect(page.getByLabel('Invitation to share')).toHaveValue(/invite=/);
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
});

test('cancelled native sharing keeps the invitation available', async ({
  page,
}) => {
  await page.addInitScript(localIce);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => {
        throw new DOMException('Cancelled', 'AbortError');
      },
    }),
  );
  await page.goto('/#/room');
  await page.getByLabel('Your room name').fill('Mira');
  await page
    .getByRole('button', { name: 'Create a room', exact: true })
    .click();
  await page.getByRole('button', { name: 'Share link' }).click();
  await expect(
    page.getByText('Sharing cancelled; your link is still available.'),
  ).toBeVisible();
  await expect(page.getByLabel('Invitation to share')).toHaveValue(/invite=/);
});
