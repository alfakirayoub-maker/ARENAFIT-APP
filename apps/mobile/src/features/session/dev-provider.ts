import AsyncStorage from '@react-native-async-storage/async-storage';

import { fixtureMember } from '@/dev/fixtures/content';
import { identity } from '@/features/auth';

import type { AuthProvider, DevSessionChoice, Session } from './types';

/**
 * DEVELOPMENT ONLY (excluded from release bundles, see providers.ts).
 *  - member-demo: fixture member for UI work — no Supabase user, no data.
 *  - member-test: signs in the local test member whose credentials come from
 *    the git-ignored .env.local (EXPO_PUBLIC_DEV_MEMBER_EMAIL / _PASSWORD).
 *  - visitor: signs out.
 */
const DEMO_KEY = 'arenafit:dev-demo-member.v1';
const testEmail = process.env.EXPO_PUBLIC_DEV_MEMBER_EMAIL;
const testPassword = process.env.EXPO_PUBLIC_DEV_MEMBER_PASSWORD;

const demo: Session = { kind: 'member', member: fixtureMember, demo: true };

export function createDevAuthProvider(base: AuthProvider): AuthProvider {
  return {
    async restore() {
      const real = await base.restore();
      if (real.kind !== 'visitor') return real;
      return (await AsyncStorage.getItem(DEMO_KEY)) === '1' ? demo : real;
    },
    async signOut() {
      await AsyncStorage.removeItem(DEMO_KEY);
      await base.signOut();
    },
    dev: {
      choices: ['visitor', 'member-demo', ...(identity && testEmail && testPassword ? (['member-test'] as const) : [])],
      async select(choice: DevSessionChoice) {
        await base.signOut();
        await AsyncStorage.setItem(DEMO_KEY, choice === 'member-demo' ? '1' : '0');
        if (choice === 'member-demo') return demo;
        if (choice === 'member-test' && identity && testEmail && testPassword) {
          await identity.signInWithPassword(testEmail, testPassword);
          return base.restore();
        }
        return { kind: 'visitor' };
      },
    },
  };
}
