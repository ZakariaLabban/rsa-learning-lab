import { describe, expect, it } from 'vitest';
import { buildKey } from '../keys/wizardModel';
import { euclidInverse } from '../euclid/euclidModel';
import { exponentiation, crtLesson, primality, rsaProof } from '../number-theory/model';
import {
  crtFrames,
  euclidFrames,
  keyFrames,
  powerFrames,
  primalityFrames,
  proofFrames,
} from './mathTraces';
import { fileFrames, journeyFrames, oaepFrames } from './protocolTraces';
import { oaepDemonstration } from '../attacks/oaepTrace';
import { guessingKey } from '../attacks/keys';
import { practiceQuestions } from './practiceModel';
import { emptyProgress, parseProgress, recordAnswer } from './practiceProgress';
import { Keyring, recipientFromEntry } from '../../keyring';
import { encrypt, decryptOwnRun, journeySteps } from '../encrypt/model';
import { toHex } from '../../engine/encoding';
import { verifyLesson } from '../signatures/model';
import { verificationFrames } from './protocolTraces';

describe('lesson animations render actual computation', () => {
  it('keeps every expanded power operation consistent with engine residues', () => {
    for (const [a, b, n] of [
      ['7', '560', '561'],
      ['-7', '23', '187'],
      ['0', '7', '187'],
      ['9', '0', '1'],
    ]) {
      const run = exponentiation(a, b, n),
        frames = powerFrames(run);
      expect(frames.at(-1)!.output.value).toBe(String(run.result.value));
      for (const f of frames)
        if (f.reduction) {
          expect(f.output.value).toBe(String(f.reduction.product % f.reduction.modulus));
        }
    }
  });
  it('covers inverse failure and exponent zero without invented operations', () => {
    expect(euclidFrames(euclidInverse(5n, 160n)).at(-1)!.output.value).toBe('No inverse');
    const frames = powerFrames(exponentiation('7', '0', '561'));
    expect(frames).toHaveLength(1);
    expect(frames[0].operation).toBe('initialize');
  });
  it('reconstructs exact CRT terms and the 1651 example', () => {
    const run = crtLesson('37,49', '23,34', '1651', 'combine'),
      frames = crtFrames(run);
    expect(frames.at(-1)!.output.value).toBe('1651');
    expect(frames.at(-1)!.reduction!.product % run.modulus).toBe(run.value);
  });
  it('preserves witness classification, special cases and non-coprime RSA proof', () => {
    expect(primalityFrames(primality('221', 'typed', '5', 1), 0).at(-1)!.output.value).toBe(
      'Composite witness',
    );
    expect(primalityFrames(primality('2', 'typed', '0', 1), 0)[0].output.value).toBe('Prime');
    const proof = rsaProof('17', '11', '7', '17');
    expect(proofFrames(proof).at(-1)!.output.value).toBe('17');
    expect(proofFrames(proof)[2].detail).toContain('does not apply');
  });
  it('redacts all private key operands until explicit reveal', () => {
    const key = buildKey(17n, 11n, 7n).key,
      frames = keyFrames(key, false);
    expect(frames[0].inputs.map((x) => x.value)).toEqual([
      'Hidden · reveal private key',
      'Hidden · reveal private key',
    ]);
    expect(frames[3].output.value).toContain('Hidden');
    expect(keyFrames(key, true)[3].output.value).toBe('23');
  });
  it('respects sender-side OAEP trace reveal, without changing ciphertext', async () => {
    const trace = await oaepDemonstration(guessingKey(1024), new TextEncoder().encode('YES'));
    expect(oaepFrames(trace, false)[1].inputs[0].value).toContain('Hidden');
    expect(oaepFrames(trace, true)[1].inputs[0].value).toHaveLength(64);
    expect(oaepFrames(trace, false).at(-1)!.output.value).toBe(
      oaepFrames(trace, true).at(-1)!.output.value,
    );
  });
  it('does not expose private journey fields in the public protocol animation', () => {
    const frames = journeyFrames([
      {
        title: 'Private operation',
        short: 'DECRYPT',
        who: 'Alice',
        formula: 'C^d mod n',
        explanation: 'Decrypt locally',
        values: [
          { label: 'd', value: 'secret-exponent', privateValue: true },
          { label: 'M', value: '88' },
        ],
      },
    ]);
    expect(JSON.stringify(frames)).not.toContain('secret-exponent');
  });
  it('redacts actual hybrid AES keys and practical OAEP blocks before and after decryption', async () => {
    const kr = new Keyring(null);
    await kr.ready;
    const alice = kr.getState().entries.find((entry) => entry.id === 'demo-alice')!;
    const recipient = recipientFromEntry(alice);
    const hybrid = await encrypt(recipient, 'text', 'hybrid', 'Check real secret fields');
    expect(hybrid.kind).toBe('hybrid');
    if (hybrid.kind !== 'hybrid') throw Error('Expected hybrid');
    const opened = await decryptOwnRun(hybrid, kr.getState().entries);
    const json = JSON.stringify(journeyFrames(journeySteps(hybrid, opened)));
    expect(json).not.toContain(toHex(hybrid.sealed.aesKey));
    const oaep = await encrypt(recipient, 'text', 'oaep', 'Padding stays local');
    if (oaep.kind !== 'text') throw Error('Expected text');
    const recovered = await decryptOwnRun(oaep, kr.getState().entries);
    const padded = toHex(oaep.sealed.inputs[0]);
    expect(JSON.stringify(journeyFrames(journeySteps(oaep, recovered)))).not.toContain(padded);
  });
  it('does not invent RSA/PSS operations for invalid signature formats', async () => {
    for (const mode of ['number', 'pss'] as const) {
      const key = mode === 'number' ? buildKey(17n, 11n, 7n).key : guessingKey(1024);
      const verdict = await verifyLesson(key, mode, mode === 'number' ? '88' : 'Message', 'abc!');
      expect(verdict.stage).toBe('format');
      const frames = verificationFrames(verdict, 'abc!', key.e, key.n);
      expect(
        frames.some((f) => f.operation === 'public RSA' || f.operation === 'RSA-PSS verify'),
      ).toBe(false);
      expect(frames.at(-1)!.output.value).toBe('Signature invalid');
      if (mode === 'number') expect(JSON.stringify(frames)).not.toContain('PSS');
    }
  });
  it('uses bounded file metadata rather than reparsing an enormous envelope', () => {
    const frames = fileFrames({
      type: 'sealed',
      size: 25 * 1024 * 1024,
      envelope: 'x'.repeat(1000),
      elapsedMs: 2,
      rsaMs: 1,
      aesMs: 1,
      rsaOnlyEstimateMs: 4,
      publicTrace: {
        nonce: 'nonce',
        wrappedKey: 'wrapped',
        ciphertextPrefix: 'abc',
        ciphertextChars: 35_000_000,
      },
    });
    expect(JSON.stringify(frames).length).toBeLessThan(2000);
    expect(frames[0].output.value).toContain('35000000');
  });
  it('practice grades are engine outputs and every solution ends with the same answer', () => {
    for (const question of practiceQuestions(7)) {
      expect(question.frames.length).toBeGreaterThan(0);
      expect(question.answer).toBeGreaterThanOrEqual(0n);
      expect(question.frames.at(-1)!.output.value).toBe(String(question.answer));
    }
    for (const difficulty of ['intro', 'exam'] as const)
      for (const seed of [0, 1, 632, 0xffffffff]) {
        const questions = practiceQuestions(seed, difficulty);
        expect(questions).toHaveLength(10);
        expect(questions.map((q) => [q.id, q.answer])).toEqual(
          practiceQuestions(seed, difficulty).map((q) => [q.id, q.answer]),
        );
        expect(new Set(questions.map((q) => q.topic)).size).toBe(10);
        const encrypted = questions[3],
          decrypted = questions[4];
        const m = BigInt(encrypted.prompt.match(/M=(\d+)/)![1]);
        const e = BigInt(encrypted.prompt.match(/e=(\d+)/)![1]),
          n = BigInt(encrypted.prompt.match(/n=(\d+)/)![1]);
        expect(encrypted.answer).toBe(m ** e % n);
        expect(decrypted.answer).toBe(m);
        const pq = questions[0].prompt.match(/p=(\d+) and q=(\d+)/)!;
        const primeP = BigInt(pq[1]),
          primeQ = BigInt(pq[2]);
        expect(questions[0].answer).toBe(primeP * primeQ);
        expect(questions[1].answer).toBe((primeP - 1n) * (primeQ - 1n));
        expect((e * questions[2].answer) % questions[1].answer).toBe(1n);
        expect(questions[5].answer).toBe(questions[2].answer);
        const power = questions[6].prompt.match(/Compute (\d+)\^(\d+) mod (\d+)/)!;
        expect(questions[6].answer).toBe(BigInt(power[1]) ** BigInt(power[2]) % BigInt(power[3]));
        expect(questions[7].answer).toBe(questions[7].prompt.includes('n=29?') ? 1n : 0n);
        const congruences = [...questions[8].prompt.matchAll(/A≡(\d+) mod(\d+)/g)];
        for (const match of congruences)
          expect(questions[8].answer % BigInt(match[2])).toBe(BigInt(match[1]));
        expect(questions[8].answer).toBeLessThan(
          BigInt(congruences[0][2]) * BigInt(congruences[1][2]),
        );
        const phiQuestion = questions[9],
          phiN = Number(phiQuestion.prompt.match(/φ\((\d+)\)/)![1]);
        const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
        expect(phiQuestion.answer).toBe(
          BigInt(
            Array.from({ length: phiN }, (_, i) => i + 1).filter((i) => gcd(i, phiN) === 1).length,
          ),
        );
      }
  });
  it('versions and validates progress, counts first attempts once, and records weak topics', () => {
    const q = practiceQuestions(632)[0];
    const first = recordAnswer(emptyProgress(), q.id, q.topic, false);
    expect(first.topics.modulus).toEqual({ attempts: 1, correct: 0 });
    expect(recordAnswer(first, q.id, q.topic, true)).toBe(first);
    const next = recordAnswer(first, 'another', 'power', true);
    expect(next.streak).toBe(1);
    expect(next.correct).toBe(1);
    expect(parseProgress(JSON.stringify(next))).toEqual(next);
    expect(parseProgress('{"version":2}')).toEqual(emptyProgress());
    expect(parseProgress(JSON.stringify({ ...next, attempts: -1 }))).toEqual(emptyProgress());
  });
  it('rejects PSS signature lengths belonging to the other key size before claiming verification', async () => {
    for (const bits of [1024, 2048] as const) {
      const key = guessingKey(bits),
        signature = '00'.repeat(bits === 1024 ? 256 : 128);
      const verdict = await verifyLesson(key, 'pss', 'Wrong-sized signature', signature);
      expect(verdict.stage).toBe('format');
      expect(
        verificationFrames(verdict, signature, key.e, key.n).some(
          (f) => f.operation === 'RSA-PSS verify',
        ),
      ).toBe(false);
    }
  });
});
