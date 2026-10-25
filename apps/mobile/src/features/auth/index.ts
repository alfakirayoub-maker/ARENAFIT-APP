import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/config/env';
import { createSessionClient } from '@/data/supabase/client';

import { createSupabaseIdentityService, type IdentityService } from './identity';

export type { AuthUser, IdentityService } from './identity';

/**
 * Supabase client carrying the guest/member session (anon key only), or null
 * when Supabase is not configured — then nobody can become a guest or member.
 */
export const sessionClient: SupabaseClient | null =
  env.supabaseUrl && env.supabaseAnonKey ? createSessionClient(env.supabaseUrl, env.supabaseAnonKey, AsyncStorage) : null;

export const identity: IdentityService | null = sessionClient ? createSupabaseIdentityService(sessionClient) : null;
