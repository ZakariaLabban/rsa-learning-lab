import { useSyncExternalStore } from 'react';
import { keyring, type KeyringState } from './store';

/** Subscribes a component to the shared keyring. */
export function useKeyring(): KeyringState {
  return useSyncExternalStore(keyring.subscribe, keyring.getState);
}
