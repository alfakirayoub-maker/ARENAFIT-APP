import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/**
 * Minimal on-device store (no account needed): an in-memory value persisted
 * to AsyncStorage. Used for favorites, reminders and local preferences until
 * a signed-in user chooses to sync them.
 */
export function createPersistedStore<T>(key: string, initial: T) {
  let state = initial;
  let changedBeforeHydration = false;
  const listeners = new Set<() => void>();
  const storageKey = `arenafit:${key}`;

  const emit = () => listeners.forEach((l) => l());

  // Hydrate once; storage failures (private mode, quota) keep the in-memory value.
  AsyncStorage.getItem(storageKey)
    .then((raw) => {
      if (raw != null && !changedBeforeHydration) {
        state = JSON.parse(raw) as T;
        emit();
      }
    })
    .catch(() => {});

  function set(update: T | ((prev: T) => T)) {
    state = typeof update === 'function' ? (update as (prev: T) => T)(state) : update;
    changedBeforeHydration = true;
    emit();
    AsyncStorage.setItem(storageKey, JSON.stringify(state)).catch(() => {});
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  const get = () => state;

  function useStore() {
    return useSyncExternalStore(subscribe, get, get);
  }

  return { get, set, useStore };
}
