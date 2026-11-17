import {
  compareDecryption,
  crtLesson,
  exponentiation,
  liarSearch,
  primality,
  residues,
  rsaProof,
} from './model';
import type { PrivateKey } from '../../engine/math';

export type LessonJobs = {
  primality: { n: string; source: 'typed' | 'random'; base: string; rounds: number };
  liars: { n: string };
  proof: { p: string; q: string; e: string; message: string };
  residues: { a: string; n: string };
  power: { a: string; b: string; n: string };
  crt: { moduli: string; residues: string; value: string; direction: 'split' | 'combine' };
  benchmark: { key: PrivateKey; message: string };
};
export type LessonResults = {
  primality: ReturnType<typeof primality>;
  liars: ReturnType<typeof liarSearch>;
  proof: ReturnType<typeof rsaProof>;
  residues: ReturnType<typeof residues>;
  power: ReturnType<typeof exponentiation>;
  crt: ReturnType<typeof crtLesson>;
  benchmark: ReturnType<typeof compareDecryption>;
};
export type LessonRequest = {
  [K in keyof LessonJobs]: { type: K; input: LessonJobs[K] };
}[keyof LessonJobs];
export function runLesson(request: LessonRequest): LessonResults[keyof LessonJobs] {
  switch (request.type) {
    case 'primality':
      return primality(
        request.input.n,
        request.input.source,
        request.input.base,
        request.input.rounds,
      );
    case 'liars':
      return liarSearch(request.input.n);
    case 'proof':
      return rsaProof(request.input.p, request.input.q, request.input.e, request.input.message);
    case 'residues':
      return residues(request.input.a, request.input.n);
    case 'power':
      return exponentiation(request.input.a, request.input.b, request.input.n);
    case 'crt':
      return crtLesson(
        request.input.moduli,
        request.input.residues,
        request.input.value,
        request.input.direction,
      );
    case 'benchmark':
      return compareDecryption(request.input.key, request.input.message);
  }
}
