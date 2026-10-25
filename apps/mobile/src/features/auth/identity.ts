import type { SupabaseClient } from '@supabase/supabase-js';

import { DataError } from '@/data/errors';
import { GuestPassError } from '@/features/guest-pass/types';

export type AuthUser = { id: string; isAnonymous: boolean };

/**
 * The only boundary that talks to Supabase Auth. Screens and components use
 * the session context and the Guest Pass hooks, never this directly.
 *
 * No identity exists until someone taps « Activer mon Pass »: visitors browse
 * with the anon key and no user. ensureGuestIdentity() then creates an
 * anonymous Supabase user — the guest identity — that the activation binds
 * to the pass. Converting that guest into a member later can use Supabase's
 * identity linking on the same user id (not implemented yet).
 */
export interface IdentityService {
  currentUser(): Promise<AuthUser | null>;
  /** Reuses this device's guest identity or creates one. Refuses member sessions. */
  ensureGuestIdentity(): Promise<{ user: AuthUser; created: boolean }>;
  signOut(): Promise<void>;
  /** Development builds only (test member sign-in from Profil › Développement). */
  signInWithPassword(email: string, password: string): Promise<AuthUser>;
}

export function createSupabaseIdentityService(client: SupabaseClient): IdentityService {
  const toUser = (u: { id: string; is_anonymous?: boolean }): AuthUser => ({ id: u.id, isAnonymous: u.is_anonymous === true });

  const service: IdentityService = {
    async currentUser() {
      // Local read of the persisted session (refreshed by supabase-js); no network.
      const { data } = await client.auth.getSession();
      return data.session ? toUser(data.session.user) : null;
    },

    async ensureGuestIdentity() {
      const existing = await service.currentUser();
      if (existing?.isAnonymous) return { user: existing, created: false };
      if (existing) throw new GuestPassError('not_eligible');
      let result: Awaited<ReturnType<typeof client.auth.signInAnonymously>>;
      try {
        result = await client.auth.signInAnonymously();
      } catch (cause) {
        throw new DataError('network', 'Guest identity request failed', { cause });
      }
      if (result.error || !result.data.user) {
        const status = (result.error as { status?: number } | null)?.status ?? 0;
        if (status === 0) throw new DataError('network', 'Guest identity request failed', { cause: result.error });
        throw new GuestPassError('no_identity', { cause: result.error });
      }
      return { user: toUser(result.data.user), created: true };
    },

    async signOut() {
      await client.auth.signOut({ scope: 'local' });
    },

    async signInWithPassword(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !data.user) throw new DataError('rejected', error?.message ?? 'Sign-in failed', { cause: error });
      return toUser(data.user);
    },
  };
  return service;
}
