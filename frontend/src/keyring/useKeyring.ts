import { createContext, useContext, useSyncExternalStore } from 'react';
import { keyring, type KeyringState } from './store';

export const KeyringContext = createContext(keyring);

export function useKeyringStore() {
  return useContext(KeyringContext);
}

/** Subscribes a component to the active profile’s keyring. */
export function useKeyring(): KeyringState {
  const store = useKeyringStore();
  return useSyncExternalStore(store.subscribe, store.getState);
}
