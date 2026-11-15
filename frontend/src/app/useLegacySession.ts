import { useEffect, useState } from 'react';
import { generateKey, type LabKey } from '../api';

/** Temporary owner of API-backed session state, retained until issue #45. */
export function useLegacySession(active: boolean) {
  const [bits, setBits] = useState(2048),
    [key, setKey] = useState<LabKey>();
  const [history, setHistory] = useState<LabKey[]>([]);
  const [generating, setGenerating] = useState(false),
    [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(''),
    [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then((r) => setOnline(r.ok))
      .catch(() => {
        if (!controller.signal.aborted) setOnline(false);
      });
    return () => controller.abort();
  }, [active]);
  useEffect(() => {
    if (!generating) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [generating]);
  async function createKey() {
    setError('');
    setGenerating(true);
    setSeconds(0);
    try {
      const result = await generateKey(bits);
      setKey(result);
      setHistory((old) => [...old.slice(-7), result]);
      setOnline(true);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setGenerating(false);
    }
  }
  return {
    key,
    setKey,
    bits,
    setBits,
    history,
    generating,
    seconds,
    error,
    setError,
    online,
    createKey,
  };
}
