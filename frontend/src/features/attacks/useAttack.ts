import { useEffect, useRef, useState } from 'react';
import type { FactorProgress } from './factoring';
import type { AttackJobs, AttackResults } from './jobs';

export function useAttack<K extends keyof AttackJobs>(type: K) {
  const [result, setResult] = useState<AttackResults[K] | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [progress, setProgress] = useState<FactorProgress | null>(null);
  const work = useRef<{ worker: Worker; timer: ReturnType<typeof setTimeout> } | null>(null);
  function stop() {
    if (!work.current) return;
    work.current.worker.terminate();
    clearTimeout(work.current.timer);
    work.current = null;
  }
  useEffect(() => () => stop(), []);
  function reset() {
    stop();
    setResult(null);
    setError('');
    setBusy(false);
    setProgress(null);
  }
  function run(input: AttackJobs[K], onResult?: (value: AttackResults[K]) => void) {
    reset();
    setBusy(true);
    try {
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      const fail = (message: string) => {
        if (work.current?.worker !== worker) return;
        stop();
        setBusy(false);
        setError(message);
      };
      const budget = type === 'factor' ? (input as AttackJobs['factor']).budgetMs : 30000;
      // The worker enforces the search budget. This watchdog also terminates a stuck worker,
      // with one second of grace for script loading/message delivery (not extra search time).
      const timer = setTimeout(
        () => fail('Deadline reached. The worker was stopped; no factors were recovered.'),
        budget + 1000,
      );
      work.current = { worker, timer };
      worker.onmessage = (
        event: MessageEvent<{
          progress?: FactorProgress;
          result?: AttackResults[K];
          error?: string;
        }>,
      ) => {
        if (work.current?.worker !== worker) return;
        if (event.data.progress) {
          setProgress(event.data.progress);
          return;
        }
        if (event.data.error) {
          fail(event.data.error);
          return;
        }
        stop();
        setBusy(false);
        if (event.data.result) {
          setResult(event.data.result);
          onResult?.(event.data.result);
        }
      };
      worker.onerror = () => fail('The demonstration worker failed. Please retry.');
      worker.onmessageerror = () => fail('Invalid worker response. Please retry.');
      worker.postMessage({ type, input });
    } catch (reason) {
      stop();
      setBusy(false);
      setError((reason as Error).message);
    }
  }
  return {
    result,
    busy,
    error,
    progress,
    run,
    reset,
    cancel: () => {
      reset();
      setError('Demonstration cancelled. The worker was stopped.');
    },
  };
}
