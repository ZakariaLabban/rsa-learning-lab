import { runLesson, type LessonRequest } from './jobs';
self.onmessage = (event: MessageEvent<LessonRequest>) => {
  try {
    self.postMessage({ result: runLesson(event.data) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Calculation failed.' });
  }
};
