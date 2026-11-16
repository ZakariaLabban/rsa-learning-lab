import { runFileJob, type FileJob } from './model';
self.onmessage = async (event: MessageEvent<FileJob>) => {
  try {
    self.postMessage({ result: await runFileJob(event.data) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'File operation failed.' });
  }
};
