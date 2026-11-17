import { useEffect, useRef, useState } from 'react';
import type { LessonJobs, LessonResults } from './jobs';

export function useLesson<K extends keyof LessonJobs>(type: K) {
  const [result, setResult] = useState<LessonResults[K] | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const work = useRef<{ worker: Worker; timer: ReturnType<typeof setTimeout> } | null>(null);
  function stop() {
    if (work.current) {
      work.current.worker.terminate();
      clearTimeout(work.current.timer);
      work.current = null;
    }
  }
  useEffect(() => () => stop(), []);
  function reset() {
    stop();
    setResult(null);
    setError('');
    setBusy(false);
  }
  function run(input: LessonJobs[K]) {
    reset();
    setBusy(true);
    try {
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      const fail = (message: string) => {
        if (work.current?.worker !== worker) return;
        stop();
        setError(message);
        setBusy(false);
      };
      const timer = setTimeout(
        () => fail('Calculation timed out. Use smaller teaching inputs.'),
        30000,
      );
      work.current = { worker, timer };
      worker.onmessage = (event: MessageEvent<{ result?: LessonResults[K]; error?: string }>) => {
        if (work.current?.worker !== worker) return;
        if (event.data.error) {
          fail(event.data.error);
          return;
        }
        stop();
        setResult(event.data.result ?? null);
        setBusy(false);
      };
      worker.onerror = () => fail('The calculation worker failed. Please try again.');
      worker.onmessageerror = () => fail('Invalid worker response. Please retry.');
      worker.postMessage({ type, input });
    } catch (e) {
      stop();
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return {
    result,
    busy,
    error,
    run,
    reset,
    cancel: () => {
      reset();
      setError('Calculation cancelled.');
    },
  };
}
