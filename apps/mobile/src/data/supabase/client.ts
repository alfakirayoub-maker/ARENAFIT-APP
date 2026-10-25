import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Requests that take longer than this fail fast and show the error state. */
const REQUEST_TIMEOUT_MS = 12_000;

// AbortController + timer rather than AbortSignal.timeout(), which not every
// JS engine (Hermes) ships.
const fetchWithTimeout: typeof fetch = (input, init) => {
  if (init?.signal) return fetch(input, init);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

/**
 * Public Supabase client: anon key only (never the service-role key).
 * No auth session is created or persisted — visitors browse without an
 * account. The auth-enabled client for guests/members comes with the
 * member activation flow.
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
