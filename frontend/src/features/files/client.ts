import type { FileJob, FileResult } from './model';

export function fileJob(job: FileJob, signal: AbortSignal): Promise<FileResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Cancelled', 'AbortError'));
      return;
    }
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const finish = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      worker.terminate();
    };
    const abort = () => {
      finish();
      reject(new DOMException('Cancelled', 'AbortError'));
    };
    const timeout = setTimeout(() => {
      finish();
      reject(new Error('File operation timed out. Try a smaller file.'));
    }, 180000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ result?: FileResult; error?: string }>) => {
      finish();
      if (event.data.result) resolve(event.data.result);
      else reject(new Error(event.data.error ?? 'File operation failed.'));
    };
    worker.onerror = () => {
      finish();
      reject(new Error('File worker failed. Please try again.'));
    };
    try {
      worker.postMessage(job);
    } catch (error) {
      finish();
      reject(error);
    }
  });
}
