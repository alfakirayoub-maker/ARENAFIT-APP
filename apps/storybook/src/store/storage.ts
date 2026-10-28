import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/** Web storage that never throws (private mode, quota exceeded, blocked storage). */
function safe(kind: 'localStorage' | 'sessionStorage'): StateStorage {
  const get = () => {
    try {
      return typeof window === 'undefined' ? null : window[kind];
    } catch {
      return null;
    }
  };
  return {
    getItem: (key) => {
      try {
        return get()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        get()?.setItem(key, value);
      } catch {
        // Quota or privacy mode: the session keeps working in memory.
      }
    },
    removeItem: (key) => {
      try {
        get()?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

export const localJSON = createJSONStorage(() => safe('localStorage'));
export const sessionJSON = createJSONStorage(() => safe('sessionStorage'));
