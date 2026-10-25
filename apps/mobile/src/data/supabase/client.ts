import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Requests that take longer than this fail fast and show the error state. */
const REQUEST_TIMEOUT_MS = 12_000;

// AbortController + timer rather than AbortSignal.timeout(), which not every
// JS engine (Hermes) ships.
export const fetchWithTimeout: typeof fetch = (input, init) => {
  if (init?.signal) return fetch(input, init);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

/**
 * Public Supabase client: anon key only (never the service-role key).
 * No auth session is created or persisted — visitors browse without an
 * account. Guests and members use createSessionClient().
 */
export function createPublicClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    // Retries are owned by TanStack Query (src/data/queries.ts). Leaving
    // supabase-js's own retries on stacks both and delays error states ~30s.
    db: { retry: false },
    global: { fetch: fetchWithTimeout },
  });
}

/** Where a session client keeps its auth session (AsyncStorage in the app). */
export type AuthStorage = {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
};

/**
 * Client carrying a user session (guest identity created at Guest Pass
 * activation, or a member). Still the anon key only: what the session may do
 * is decided by RLS and the server functions, never by the app.
 */
export function createSessionClient(url: string, anonKey: string, storage?: AuthStorage): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: storage !== undefined,
      storage,
      storageKey: 'arenafit-auth',
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    db: { retry: false },
    global: { fetch: fetchWithTimeout },
  });
}
