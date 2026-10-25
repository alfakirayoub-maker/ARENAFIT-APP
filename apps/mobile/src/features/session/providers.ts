import type { AuthProvider } from './types';

/**
 * Release builds until member activation exists: everyone is a visitor and no
 * Supabase user is ever created.
 */
export const visitorAuthProvider: AuthProvider = {
  restore: async () => ({ kind: 'visitor' }),
  signOut: async () => {},
};

/**
 * Provider in use. Development builds get the mock provider (fixture member,
 * switchable from Profil › Développement). The inline require below keeps it —
 * and its mock member data — out of release bundles.
 */
export const authProvider: AuthProvider =
  // NODE_ENV (inlined at build time, unlike __DEV__) lets Metro drop the
  // dev-only branch and its require from release bundles.
  process.env.NODE_ENV !== 'production'
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- dev-only module, excluded from release bundles
  ? (require('./mock-provider') as typeof import('./mock-provider')).mockAuthProvider
  : visitorAuthProvider;
