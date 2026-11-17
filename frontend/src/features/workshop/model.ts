import { deriveKey, modexp, squareAndMultiply } from '../../engine/math';

export const teachingKey = deriveKey(17n, 11n, 7n);
export type MachineKind = 'encrypt' | 'decrypt';
export type LearningMode = 'guided' | 'explore';
export type Station = 'sender' | MachineKind | 'eve' | 'receiver';
export type Calculation = {
  type: 'Square' | 'Multiply';
  bitIndex: number;
  bit: 0 | 1;
  a: bigint;
  b: bigint;
  product: bigint;
  quotient: bigint;
  remainder: bigint;
};

/** Expand the engine's actual per-bit trace into visible square/multiply operations. */
export function machineTrace(base: bigint, exponent: bigint): Calculation[] {
  const { rows } = squareAndMultiply(base, exponent, teachingKey.n, { trace: true });
  const operations: Calculation[] = [];
  let result = 1n;
  rows.forEach((row, bitIndex) => {
    const product = result * result;
    operations.push({
      type: 'Square',
      bitIndex,
      bit: row.bit,
      a: result,
      b: result,
      product,
      quotient: product / teachingKey.n,
      remainder: row.square,
    });
    if (row.bit) {
      const product = row.square * base;
      operations.push({
        type: 'Multiply',
        bitIndex,
        bit: row.bit,
        a: row.square,
        b: base,
        product,
        quotient: product / teachingKey.n,
        remainder: row.f,
      });
    }
    result = row.f;
  });
  return operations;
}

export function readMessage(value: string): bigint | null {
  if (!/^\d{1,3}$/.test(value.trim())) return null;
  const message = BigInt(value.trim());
  return message < teachingKey.n ? message : null;
}

export function messageJourney(message: bigint, altered: boolean) {
  const ciphertext = modexp(message, teachingKey.e, teachingKey.n);
  const wire = altered ? (ciphertext + 1n) % teachingKey.n : ciphertext;
  return { ciphertext, wire, recovered: modexp(wire, teachingKey.d, teachingKey.n) };
}

export type Journey = {
  progress: number;
  playing: boolean;
  machine: MachineKind | null;
  automatic: boolean;
};
export const initialJourney: Journey = {
  progress: 0,
  playing: false,
  machine: null,
  automatic: false,
};
export function advanceJourney(previous: Journey, delta: number): Journey {
  if (!previous.playing || previous.machine) return previous;
  const progress = Math.min(100, previous.progress + delta);
  const machine =
    previous.progress < 16 && progress >= 16
      ? 'encrypt'
      : previous.progress < 64 && progress >= 64
        ? 'decrypt'
        : null;
  if (machine)
    return { progress: machine === 'encrypt' ? 16 : 64, machine, playing: false, automatic: true };
  return { ...previous, progress, playing: progress < 100 };
}

export function journeyPhase(progress: number) {
  return progress < 16 ? 0 : progress < 39 ? 1 : progress < 64 ? 2 : progress < 87 ? 3 : 4;
}
