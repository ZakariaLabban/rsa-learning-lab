import { describe, expect, it } from 'vitest';
import {
  advanceJourney,
  initialJourney,
  machineTrace,
  messageJourney,
  readMessage,
  teachingKey,
} from './model';

describe('animated workshop uses the real RSA trace', () => {
  it('recovers every teaching message, including zero and non-coprime values', () => {
    for (let message = 0n; message < 187n; message++) {
      const { ciphertext, recovered } = messageJourney(message, false);
      expect(ciphertext).toBe(message ** 7n % 187n);
      expect(recovered).toBe(message);
      for (const [base, exponent] of [
        [message, teachingKey.e],
        [ciphertext, teachingKey.d],
      ]) {
        const steps = machineTrace(base, exponent);
        expect(steps.at(-1)?.remainder).toBe(base ** exponent % 187n);
        for (const step of steps) {
          expect(step.product).toBe(step.a * step.b);
          expect(step.product).toBe(step.quotient * 187n + step.remainder);
          expect(step.remainder).toBeGreaterThanOrEqual(0n);
          expect(step.remainder).toBeLessThan(187n);
        }
      }
    }
  });
  it('squares but does not multiply for the zero bit in the private exponent', () => {
    const steps = machineTrace(11n, 23n);
    expect(steps).toHaveLength(9);
    expect(steps.filter((step) => step.bitIndex === 1).map((step) => step.type)).toEqual([
      'Square',
    ]);
    expect(steps.at(-1)?.remainder).toBe(88n);
  });
  it('changes the actual recovered plaintext when Eve changes the ciphertext', () => {
    const original = messageJourney(88n, false),
      altered = messageJourney(88n, true);
    expect(altered.wire).toBe(original.ciphertext + 1n);
    expect(altered.recovered).toBe(altered.wire ** 23n % 187n);
    expect(altered.recovered).not.toBe(88n);
  });
  it('accepts only bounded unsigned integer input', () => {
    for (const value of ['', '-1', '1.5', '187', '1e2', 'abc', '9'.repeat(1000)])
      expect(readMessage(value)).toBeNull();
    expect(readMessage('0')).toBe(0n);
    expect(readMessage('186')).toBe(186n);
  });
});

it('pauses the journey at both machine entrances and finishes without overshooting', () => {
  expect(advanceJourney(initialJourney, 100)).toEqual(initialJourney);
  expect(advanceJourney({ ...initialJourney, playing: true }, 100)).toMatchObject({
    progress: 16,
    machine: 'encrypt',
    playing: false,
    automatic: true,
  });
  expect(advanceJourney({ ...initialJourney, progress: 39, playing: true }, 50)).toMatchObject({
    progress: 64,
    machine: 'decrypt',
    playing: false,
  });
  expect(advanceJourney({ ...initialJourney, progress: 87, playing: true }, 50)).toMatchObject({
    progress: 100,
    playing: false,
    machine: null,
  });
});
