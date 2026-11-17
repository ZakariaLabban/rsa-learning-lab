import { runAttack, type AttackRequest } from './jobs';
self.onmessage = async (event: MessageEvent<AttackRequest>) => {
  try {
    const result = await runAttack(event.data, (progress) => self.postMessage({ progress }));
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'The demonstration failed.',
    });
  }
};
