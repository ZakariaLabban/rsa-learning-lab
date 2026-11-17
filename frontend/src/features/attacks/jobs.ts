import { factorRace, type FactorProgress } from './factoring';
import { factoringFixtures } from './keys';
import { guessingLesson, type Vote } from './guessing';
import { broadcastLesson, type BroadcastMode, type BroadcastScenario } from './broadcast';

export type AttackJobs = {
  factor: { fixture: number; budgetMs: number };
  guess: { vote: Vote; bits: 1024 | 2048 };
  broadcast: { message: string; mode: BroadcastMode; scenario: BroadcastScenario };
};
export type AttackResults = {
  factor: ReturnType<typeof factorRace> & {
    bits: number;
    n: bigint;
    e: bigint;
    ciphertext: bigint;
    expected: string;
  };
  guess: Awaited<ReturnType<typeof guessingLesson>>;
  broadcast: Awaited<ReturnType<typeof broadcastLesson>>;
};
export type AttackRequest = {
  [K in keyof AttackJobs]: { type: K; input: AttackJobs[K] };
}[keyof AttackJobs];
export async function runAttack(
  request: AttackRequest,
  progress: (value: FactorProgress) => void = () => {},
) {
  switch (request.type) {
    case 'factor': {
      const fixture = Number.isSafeInteger(request.input.fixture)
        ? factoringFixtures[request.input.fixture]
        : undefined;
      if (!fixture) throw new Error('Choose a bundled tiny-key fixture.');
      const n = BigInt(fixture.n),
        e = BigInt(fixture.e),
        ciphertext = BigInt(fixture.ciphertext);
      return {
        ...factorRace(
          {
            key: { n, e },
            ciphertext,
            byteLength: fixture.byteLength,
            budgetMs: request.input.budgetMs,
          },
          { progress },
        ),
        bits: fixture.bits,
        n,
        e,
        ciphertext,
        expected: fixture.message,
      };
    }
    case 'guess':
      return guessingLesson(request.input.vote, request.input.bits);
    case 'broadcast':
      return broadcastLesson(request.input.message, request.input.mode, request.input.scenario);
  }
}
