/**
 * Web preview: browsers have no secure enclave, so this is plain
 * localStorage (review builds only — the app ships on iOS/Android).
 */
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const secureKv = {
  get: async (key: string): Promise<string | null> => storage()?.getItem(key) ?? null,
  set: async (key: string, value: string): Promise<void> => storage()?.setItem(key, value),
  remove: async (key: string): Promise<void> => storage()?.removeItem(key),
};
