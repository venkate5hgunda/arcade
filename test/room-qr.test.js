import test from 'node:test';
import assert from 'node:assert/strict';
import { roomQrDataUrl } from '../js/room-qr.js';

test('room links become locally generated GIF QR images with no external request', () => {
  for (const kind of ['invite', 'answer']) {
    const url = `https://example.test/arcade/index.html?${kind}=${'a'.repeat(1200)}#/`;
    const image = roomQrDataUrl(url);
    assert.match(image, /^data:image\/gif;base64,R0lGOD/);
    assert.ok(image.length < 25000, 'large room links remain practical to display');
  }
});

test('QR capacity and invalid URLs fail explicitly so sharing can fall back to the URL', () => {
  assert.throws(() => roomQrDataUrl('https://example.test/?invite=' + 'x'.repeat(5000)),
    { name: 'RangeError', message: /too long.*Copy link/ });
  assert.throws(() => roomQrDataUrl('/relative'), { name: 'TypeError' });
});
