import { useEffect, useRef, useState } from 'react';
import { adoptKey, generateKey, privateKeyFor, type LabKey } from '../engine/client';
import type { PrivateKey } from '../engine/math';
import { useKeyringStore } from '../keyring';

export function useBrowserSession() {
  const keyring = useKeyringStore();
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
      // Every generated key also appears in the shared keyring under "My keys".
      // It also becomes the active key, so Encrypt / Decrypt uses it by default.
      keyring
        .addMine(privateKeyFor(result.id), `Generated ${result.bits}-bit key`)
        .then((entry) => keyring.setActive(entry.id))
        .catch(() => setError('The key works here but could not be added to your keyring.'));
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
  /** Makes a keyring key (mine, demo or imported) the key used by Key Studio and the Workbench. */
  async function activateKey(privateKey: PrivateKey) {
    const result = await adoptKey(privateKey);
    setKey(result);
    setHistory((old) => [...old.slice(-7), result]);
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
    activateKey,
  };
}
