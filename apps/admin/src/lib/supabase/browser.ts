'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { env } from '../env';

let client: SupabaseClient | null = null;

/**
 * Browser client: anon key + the signed-in staff member's session (cookies).
 * What it may read or write is decided by RLS and role-checked functions.
 */
export function getBrowserClient(): SupabaseClient {
  if (!client) client = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey) as unknown as SupabaseClient;
  return client;
}
