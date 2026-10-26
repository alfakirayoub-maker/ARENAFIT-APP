import { identity } from '@/features/auth';

import type { AuthProvider } from './types';

/**
 * STAGING DEMO BUILDS ONLY (EXPO_PUBLIC_STAGING_DEMO_SIGNIN=1, see providers.ts).
 *
 * Member sign-in is not built yet. For stakeholder demos on the staging project,
 * Profil → « Accès démo » signs the demo member in with real Supabase auth
 * (email + password of the staging demo account, from the EAS « preview »
 * environment). No fixture member, no simulated session. Production builds
 * never set the flag, so this module is not in their bundle
 * (scripts/check-release-bundle.sh verifies it).
 */
const email = process.env.EXPO_PUBLIC_STAGING_MEMBER_EMAIL;
const password = process.env.EXPO_PUBLIC_STAGING_MEMBER_PASSWORD;

export function createStagingDemoAuthProvider(base: AuthProvider): AuthProvider {
  const canSignIn = !!(identity && email && password);
  return {
    restore: () => base.restore(),
    signOut: () => base.signOut(),
    dev: {
      kind: 'staging',
      choices: canSignIn ? ['visitor', 'member-test'] : ['visitor'],
      async select(choice) {
        await base.signOut();
        if (choice === 'member-test' && identity && email && password) {
          await identity.signInWithPassword(email, password);
          return base.restore();
        }
        return { kind: 'visitor' };
      },
    },
  };
}
