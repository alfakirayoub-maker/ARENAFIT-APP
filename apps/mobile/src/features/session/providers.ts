import { identity, sessionClient } from '@/features/auth';
import { loadMemberProfile } from '@/features/auth/member-profile';

import type { AuthProvider, Session } from './types';

/** No Supabase configured: everyone is a visitor and no user is ever created. */
export const visitorAuthProvider: AuthProvider = {
  restore: async () => ({ kind: 'visitor' }),
  signOut: async () => {},
};

/**
 * Real sessions from the persisted Supabase auth session. No session → visitor
 * (no user is created on launch). Anonymous user → guest. A member session
 * only exists if a member signed in — release builds have no member sign-in
 * yet, so there it never happens.
 */
export const supabaseAuthProvider: AuthProvider | null =
  identity && sessionClient
    ? {
        async restore(): Promise<Session> {
          const user = await identity!.currentUser();
          if (!user) return { kind: 'visitor' };
          if (user.isAnonymous) return { kind: 'guest', userId: user.id };
          const member = await loadMemberProfile(sessionClient!, user.id);
          return member ? { kind: 'member', member, demo: false } : { kind: 'visitor' };
        },
        signOut: () => identity!.signOut(),
      }
    : null;

const releaseProvider: AuthProvider = supabaseAuthProvider ?? visitorAuthProvider;

/**
 * Provider in use. Development builds wrap it with dev controls (demo member,
 * test member sign-in). The inline require keeps that module — its fixture
 * member and test credentials — out of release bundles.
 */
export const authProvider: AuthProvider =
  // NODE_ENV (inlined at build time, unlike __DEV__) lets Metro drop the
  // dev-only branch and its require from release bundles.
  process.env.NODE_ENV !== 'production'
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- dev-only module, excluded from release bundles
  ? (require('./dev-provider') as typeof import('./dev-provider')).createDevAuthProvider(releaseProvider)
  : releaseProvider;
