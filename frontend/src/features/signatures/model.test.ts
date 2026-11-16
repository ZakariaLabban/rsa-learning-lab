import { expect, it } from 'vitest';
import refs from '../../engine/__vectors__/reference-vectors.json';
import { deriveKey } from '../../engine/math';
import { signLesson, verifyLesson } from './model';
const keys = refs.keys.map((k) => deriveKey(BigInt(k.p), BigInt(k.q), BigInt(k.e)));
const lecture = deriveKey(17n, 11n, 7n);
it('teaches raw signature recovery and the explicit hash-mod-187 collision', async () => {
  const raw = await signLesson(lecture, 'number', '88');
  expect(await verifyLesson(lecture, 'number', '88', raw.signature)).toMatchObject({
    valid: true,
    recovered: '88',
  });
  expect(await verifyLesson(lecture, 'number', '89', raw.signature)).toMatchObject({
    valid: false,
  });
  const hashed = await signLesson(lecture, 'hash', '16');
  expect(hashed.digest).toBe('24');
  expect(await verifyLesson(lecture, 'hash', '46', hashed.signature)).toMatchObject({
    valid: true,
    digest: '24',
  });
  await expect(signLesson(lecture, 'number', '187')).rejects.toThrow('less than n');
});
it('PSS verifies both key sizes and rejects changed messages, signatures and wrong keys', async () => {
  for (const key of keys) {
    const signed = await signLesson(key, 'pss', 'مرحبا 🔐');
    expect(signed.hash).toHaveLength(64);
    expect(await verifyLesson(key, 'pss', 'مرحبا 🔐', signed.signature)).toMatchObject({
      valid: true,
    });
    expect(await verifyLesson(key, 'pss', 'مرحبا 🔐!', signed.signature)).toMatchObject({
      valid: false,
    });
    const changed = (signed.signature[0] === '0' ? '1' : '0') + signed.signature.slice(1);
    expect(await verifyLesson(key, 'pss', 'مرحبا 🔐', changed)).toMatchObject({ valid: false });
    expect(
      await verifyLesson(
        keys.find((k) => k !== key)!,
        'pss',
        'مرحبا 🔐',
        signed.signature,
      ),
    ).toMatchObject({ valid: false });
    expect(await verifyLesson(key, 'pss', '', 'not hex')).toMatchObject({ valid: false });
  }
});
it('enforces input and key capabilities without parsing unbounded integers', async () => {
  await expect(signLesson(lecture, 'pss', 'hello')).rejects.toThrow('Use RSA-PSS');
  await expect(signLesson(keys[0], 'pss', '🔐'.repeat(3000))).rejects.toThrow('10,000');
  await expect(signLesson(lecture, 'number', '9'.repeat(1000))).rejects.toThrow('20 digits');
  expect(await verifyLesson(lecture, 'hash', 'hello', '9'.repeat(1000))).toMatchObject({
    valid: false,
  });
});
