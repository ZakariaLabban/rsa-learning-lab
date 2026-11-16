import type { PrivateKey } from './math';
import { bitLength } from './math';
import { fingerprint } from './encoding';
import type { KeyBits, KeyProgress } from './keys/keygen';
import type { WorkerRequest } from './worker';
import type { CipherResult, LabKey, Mode, Recovered } from './operations';
export type { LabKey, CipherResult, Mode, Recovered } from './operations';

const vault = new Map<string, PrivateKey>();
function computation<T>(
  request: WorkerRequest,
  options: { signal?: AbortSignal; onProgress?: (progress: KeyProgress) => void } = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new DOMException('Generation cancelled.', 'AbortError'));
      return;
    }
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    let settled = false;
    const finish = (result?: T, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
      worker.terminate();
      if (error) reject(error);
      else resolve(result as T);
    };
    const abort = () => finish(undefined, new DOMException('Generation cancelled.', 'AbortError'));
    const timer = setTimeout(
      () => finish(undefined, new Error('Computation timed out. Please retry.')),
      180000,
    );
    options.signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event) => {
      if (settled) return;
      if (event.data.type === 'progress') options.onProgress?.(event.data.progress);
      else if (event.data.type === 'error') finish(undefined, new Error(event.data.error));
      else if (event.data.type === 'result') finish(event.data.result);
    };
    worker.onerror = () => finish(undefined, new Error('The browser worker failed. Please retry.'));
    worker.onmessageerror = () => finish(undefined, new Error('Invalid worker response.'));
    worker.postMessage(request);
  });
}
export async function generateKey(
  bits: number,
  options: { signal?: AbortSignal; onProgress?: (progress: KeyProgress) => void } = {},
): Promise<LabKey> {
  if (![8, 16, 32, 64, 1024, 2048].includes(bits)) throw new Error('Unsupported key size.');
  const result = await computation<{ key: PrivateKey; candidates: number; elapsed_ms: number }>(
    { type: 'generate', bits: bits as KeyBits },
    options,
  );
  const identity = await fingerprint(result.key);
  if (options.signal?.aborted) throw new DOMException('Generation cancelled.', 'AbortError');
  const id = crypto.randomUUID();
  vault.set(id, result.key);
  if (vault.size > 8) vault.delete(vault.keys().next().value!);
  return {
    id,
    n: String(result.key.n),
    e: String(result.key.e),
    bits: bitLength(result.key.n),
    fingerprint: identity,
    candidates: result.candidates,
    elapsed_ms: result.elapsed_ms,
  };
}
/** Registers an existing private key (for example from the keyring) for this tab's workers. */
export async function adoptKey(key: PrivateKey): Promise<LabKey> {
  const identity = await fingerprint(key);
  const id = crypto.randomUUID();
  vault.set(id, key);
  if (vault.size > 8) vault.delete(vault.keys().next().value!);
  return {
    id,
    n: String(key.n),
    e: String(key.e),
    bits: bitLength(key.n),
    fingerprint: identity,
    candidates: 0,
    elapsed_ms: 0,
  };
}
/** The full private key behind a tab key id, so it can be added to the keyring. */
export function privateKeyFor(id: string): PrivateKey {
  return privateKey(id);
}
function privateKey(id: string): PrivateKey {
  const key = vault.get(id);
  if (!key) throw new Error('This private key is no longer in this tab. Generate a new key.');
  return key;
}
export async function revealPrivateKey(id: string): Promise<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(privateKey(id))
      .filter(([name]) => ['p', 'q', 'd', 'phi', 'lambda'].includes(name))
      .map(([name, value]) => [name, String(value)]),
  );
}
export function encryptMessage(id: string, message: string, mode: Mode): Promise<CipherResult> {
  return computation({ type: 'encrypt', key: privateKey(id), message, mode });
}
export function decryptEnvelope(id: string, envelope: string): Promise<Recovered> {
  return computation({ type: 'decrypt', key: privateKey(id), envelope });
}
