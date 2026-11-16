import { generateRsaKey, type KeyBits } from './keys/keygen';
import { decryptMessage, encryptMessage, type Mode } from './operations';
import type { PrivateKey } from './math';

export type WorkerRequest =
  | { type: 'generate'; bits: KeyBits }
  | { type: 'encrypt'; key: PrivateKey; message: string; mode: Mode }
  | { type: 'decrypt'; key: PrivateKey; envelope: string };

// No production request accepts injected randomness, OAEP seeds or PSS salts.
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    const request = event.data;
    if (request.type === 'generate') {
      const start = performance.now();
      let lastProgress = -Infinity;
      const result = generateRsaKey(request.bits, (progress) => {
        if (performance.now() - lastProgress >= 50 || progress.phase === 'checking') {
          self.postMessage({ type: 'progress', progress });
          lastProgress = performance.now();
        }
      });
      self.postMessage({
        type: 'result',
        result: { ...result, elapsed_ms: performance.now() - start },
      });
    } else if (request.type === 'encrypt') {
      self.postMessage({
        type: 'result',
        result: await encryptMessage(request.key, request.message, request.mode),
      });
    } else if (request.type === 'decrypt') {
      self.postMessage({
        type: 'result',
        result: await decryptMessage(request.key, request.envelope),
      });
    } else throw new Error('Unsupported worker request.');
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Computation failed.',
    });
  }
};
