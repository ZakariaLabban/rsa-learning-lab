import { useEffect, useRef, useState } from 'react';
import { generateKey, type LabKey } from '../engine/client';

export function useBrowserSession() {
  const [bits, setBits] = useState(2048),
    [key, setKey] = useState<LabKey>();
  const [history, setHistory] = useState<LabKey[]>([]),
    [generating, setGenerating] = useState(false);
  const [seconds, setSeconds] = useState(0),
    [candidates, setCandidates] = useState(0),
    [error, setError] = useState('');
  const generation = useRef<AbortController | null>(null);
  useEffect(() => () => generation.current?.abort(), []);
  useEffect(() => {
    if (!generating) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [generating]);
  async function createKey() {
    if (generation.current) return;
    const controller = new AbortController();
    generation.current = controller;
    setGenerating(true);
    setSeconds(0);
    setCandidates(0);
    setError('');
    try {
      const result = await generateKey(bits, {
        signal: controller.signal,
        onProgress: (progress) => {
          if (generation.current === controller && !controller.signal.aborted)
            setCandidates(progress.candidates);
        },
      });
      if (generation.current !== controller || controller.signal.aborted) return;
      setKey(result);
      setHistory((old) => [...old.slice(-7), result]);
      setCandidates(result.candidates);
    } catch (error) {
      if (generation.current === controller && !controller.signal.aborted)
        setError((error as Error).message);
    } finally {
      if (generation.current === controller) {
        generation.current = null;
        setGenerating(false);
      }
    }
  }
  function cancelGeneration() {
    generation.current?.abort();
    generation.current = null;
    setGenerating(false);
  }
  return {
    bits,
    setBits,
    key,
    setKey,
    history,
    generating,
    seconds,
    candidates,
    error,
    setError,
    createKey,
    cancelGeneration,
  };
}
