import { qrcode } from './vendor/qrcode.mjs';

export function roomQrDataUrl(url) {
  if (typeof url !== 'string' || !/^https?:\/\//.test(url))
    throw new TypeError('A complete room link is required for a QR code.');
  const code = qrcode(0, 'L');
  code.addData(url, 'Byte');
  try {
    code.make();
  } catch (error) {
    if (/code length overflow/i.test(String(error)))
      throw new RangeError('This link is too long for one QR code. Use Share or Copy link instead.');
    throw error;
  }
  return code.createDataURL(4, 16);
}
