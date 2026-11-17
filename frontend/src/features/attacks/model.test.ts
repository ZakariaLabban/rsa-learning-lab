import { describe, expect, it } from 'vitest';
import { bitLength, encryptInt, gcd, os2ip } from '../../engine/math';
import { equalBytes, fromHex, mgf1, oaepDecode, toHex, utf8, xor } from '../../engine/encoding';
import { factorRace, trialEstimate } from './factoring';
import { broadcastKeys, factoringFixtures, guessingKey } from './keys';
import { BROADCAST_MESSAGE, broadcastLesson, recoverBroadcast } from './broadcast';
import { guessingLesson } from './guessing';
import { runAttack } from './jobs';

describe('bounded tiny-key factoring', () => {
  it('actually factors bundled small public keys, reconstructs d and decrypts HI', async () => {
    for (const fixture of factoringFixtures.filter((value) => value.bits <= 32)) {
      const progress: number[] = [];
      const value = factorRace(
        {
          key: { n: BigInt(fixture.n), e: BigInt(fixture.e) },
          ciphertext: BigInt(fixture.ciphertext),
          byteLength: 2,
          budgetMs: 30000,
        },
        { progress: (event) => progress.push(event.attempts) },
      );
      expect(value.status).toBe('factored');
      if (value.status !== 'factored') throw new Error();
      expect(value.p * value.q).toBe(BigInt(fixture.n));
      expect((BigInt(fixture.e) * value.d) % value.phi).toBe(1n);
      expect(value.bytes).toEqual(utf8.encode('HI'));
      expect(value.attempts).toBeGreaterThan(0);
      expect(progress[0]).toBe(0);
    }
    expect(
      await runAttack({ type: 'factor', input: { fixture: 0, budgetMs: 1000 } }),
    ).toMatchObject({ status: 'factored', bits: 16 });
  });
  it('honors a deadline before finding a large factor and rejects unsafe bounds', () => {
    const fixture = factoringFixtures.at(-1)!;
    let ticks = 0;
    const request = {
      key: { n: BigInt(fixture.n), e: BigInt(fixture.e) },
      ciphertext: BigInt(fixture.ciphertext),
      byteLength: 2,
      budgetMs: 100,
    };
    const run = factorRace(request, { now: () => (ticks += 50) });
    expect(run).toMatchObject({ status: 'timeout', attempts: 256 });
    expect(run.elapsedMs).toBeLessThanOrEqual(150);
    expect(() => factorRace({ ...request, budgetMs: 30001 })).toThrow('30 seconds');
    expect(() => factorRace({ ...request, key: { n: 1n << 60n, e: 17n } })).toThrow('16–52');
    expect(trialEstimate({ attempts: 100, divisor: 201n, elapsedMs: 10 }, 32)).toMatchObject({
      trials: 32767,
      milliseconds: 3276.7,
    });
    expect(trialEstimate(run, 1024)).toBeNull();
  });
});
describe('YES / NO dictionary guessing and live OAEP values', () => {
  it('recovers both textbook votes at each size, while every repeated OAEP sample still decrypts', async () => {
    for (const bits of [1024, 2048] as const)
      for (const vote of ['YES', 'NO'] as const) {
        const run = await guessingLesson(vote, bits);
        expect(run.recoveredVote).toBe(vote);
        expect(run.recovered).toBe(vote);
        expect(run.oaepRecovered).toEqual([vote, vote, vote]);
        const first = run.oaep[0];
        expect(await oaepDecode(first.encoded)).toEqual(utf8.encode(vote));
        expect(first.maskedDb).toEqual(xor(first.db, await mgf1(first.seed, first.db.length)));
        expect(first.maskedSeed).toEqual(xor(first.seed, await mgf1(first.maskedDb, 32)));
        expect(first.encoded[0]).toBe(0);
        expect(first.seed.length).toBe(32);
        expect(equalBytes(first.ciphertext, run.textbook.intercepted)).toBe(false);
        expect(run.oaepMatches).toEqual({ yes: false, no: false });
      }
  });
  it('produces fresh independent traces, handles empty labels and never accepts injected seeds', async () => {
    const a = await guessingLesson('YES', 1024),
      b = await guessingLesson('YES', 1024);
    expect(toHex(a.oaep[0].seed)).not.toBe(toHex(b.oaep[0].seed));
    expect(a.oaep[0].labelHash).toEqual(
      fromHex('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'),
    );
    expect(a.oaep[0].padding.every((value) => value === 0)).toBe(true);
    await expect(guessingLesson('MAYBE' as 'YES', 1024)).rejects.toThrow('YES or NO');
  });
});
describe('three-recipient small-e broadcast', () => {
  it('uses distinct pairwise-coprime 1024-bit e=3 fixtures, wraps each raw cube, then recovers it via public CRT', async () => {
    const keys = broadcastKeys(),
      m = os2ip(utf8.encode(BROADCAST_MESSAGE));
    for (let i = 0; i < keys.length; i++) {
      expect(bitLength(keys[i].n)).toBe(1024);
      expect(keys[i].e).toBe(3n);
      expect(m ** 3n > keys[i].n).toBe(true);
      for (let j = 0; j < i; j++) expect(gcd(keys[i].n, keys[j].n)).toBe(1n);
    }
    const ciphertexts = keys.map((key) => encryptInt(m, key));
    const attack = recoverBroadcast(
      keys.map((key) => ({ n: key.n, e: key.e })),
      ciphertexts,
    );
    expect(attack.value).toBe(m ** 3n);
    expect(attack.exactCube).toBe(true);
    expect(attack.candidate).toBe(m);
    expect(attack.text).toBe(BROADCAST_MESSAGE);
    expect(await broadcastLesson(BROADCAST_MESSAGE, 'textbook', 'normal')).toMatchObject({
      matchesOriginal: true,
      allRecipientsRecovered: true,
    });
  });
  it('fresh OAEP encryptions still decrypt but do not recover the original common integer with the cube-root procedure', async () => {
    const run = await broadcastLesson(BROADCAST_MESSAGE, 'oaep', 'normal');
    expect(run.allRecipientsRecovered).toBe(true);
    expect(run.commonRawInteger).toBe(false);
    expect(run.matchesOriginal).toBe(false);
    expect(run.attack?.exactCube).toBe(false);
  });
  it('explains shared factors, changed messages, large e, and out-of-range M instead of implying general security', async () => {
    const shared = await broadcastLesson(BROADCAST_MESSAGE, 'textbook', 'shared-factor');
    expect(shared.problem).toContain('share a factor');
    expect(shared.attack).toBeNull();
    const e = await broadcastLesson(BROADCAST_MESSAGE, 'textbook', 'large-exponent');
    expect(e.problem).toContain('e=65537 stops this particular procedure');
    expect(e.matchesOriginal).toBe(false);
    const different = await broadcastLesson(BROADCAST_MESSAGE, 'textbook', 'different-messages');
    expect(different.commonRawInteger).toBe(false);
    expect(different.matchesOriginal).toBe(false);
    await expect(broadcastLesson(BROADCAST_MESSAGE, 'textbook', 'out-of-range')).rejects.toThrow(
      'M must satisfy',
    );
    await expect(broadcastLesson('🔐'.repeat(20), 'oaep', 'normal')).rejects.toThrow(
      '61 UTF-8 bytes',
    );
    expect(() => recoverBroadcast([], [])).toThrow('three recipients');
    const key = guessingKey(1024);
    expect(() => recoverBroadcast([key, key, key], [0n, 0n, 0n])).toThrow('share a factor');
  });
});
