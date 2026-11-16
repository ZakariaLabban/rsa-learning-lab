import { expect, it } from 'vitest';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { Keyring, keyPairFile } from '../../keyring';
import { parseContact, shareText } from './model';
it('shares only public fields, preserves the fingerprint and rejects private key import as a contact', async () => {
  const ring = new Keyring(null);
  await ring.ready;
  const alice = ring.get('demo-alice')!;
  const text = shareText(alice);
  expect(Object.keys(JSON.parse(text)).sort()).toEqual(
    ['format', 'name', 'bits', 'n', 'e', 'fingerprint'].sort(),
  );
  expect((await parseContact(text)).fingerprint).toBe(alice.fingerprint);
  await expect(
    parseContact(keyPairFile(alice.name, alice.privateKey!, alice.fingerprint)),
  ).rejects.toThrow('public-key .pub files only');
  await expect(parseContact('https://example.com/key')).rejects.toThrow('valid public-key');
  const modified = JSON.parse(text);
  modified.n = String(BigInt(modified.n) + 2n);
  await expect(parseContact(JSON.stringify(modified))).rejects.toThrow('fingerprint');
});
it('bundled QR decoder recovers a 2048-bit public key at phone-display sizes with a quiet border', async () => {
  const ring = new Keyring(null);
  await ring.ready;
  const text = shareText(ring.get('demo-alice')!);
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  for (const scale of [3, 5]) {
    const size = (qr.modules.size + 8) * scale;
    const rgba = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const row = Math.floor(y / scale) - 4,
          col = Math.floor(x / scale) - 4;
        if (
          row >= 0 &&
          col >= 0 &&
          row < qr.modules.size &&
          col < qr.modules.size &&
          qr.modules.get(row, col)
        ) {
          const i = (y * size + x) * 4;
          rgba[i] = rgba[i + 1] = rgba[i + 2] = 0;
        }
      }
    expect(jsQR(rgba, size, size)?.data).toBe(text);
  }
});
