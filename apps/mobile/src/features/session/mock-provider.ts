import { fixtureGuestPasses, fixtureMember } from '@/dev/fixtures/content';

import type { AuthProvider, Session, SessionKind } from './types';

/**
 * DEVELOPMENT ONLY — fake sessions for UI work. No authentication, no
 * Supabase user, no membership sync. Loaded only when __DEV__ is true.
 */
function mockSession(kind: SessionKind): Session {
  switch (kind) {
    case 'member':
      return { kind: 'member', member: fixtureMember, guestPasses: fixtureGuestPasses };
    case 'guest':
      return { kind: 'guest', firstName: 'Sara' };
    case 'visitor':
      return { kind: 'visitor' };
  }
}

export const mockAuthProvider: AuthProvider = {
  restore: async () => mockSession('member'),
  signOut: async () => {},
  mock: mockSession,
};
