import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { fixtureGuestPasses, fixtureMember } from '@/dev/fixtures/content';
import type { GuestPassSummary, MemberProfile } from '@/types/domain';

/**
 * Who is using the app.
 *
 *  - visitor: default. Browses planning, activities, coaches and news with no
 *    account and no Supabase user. Favorites/reminders live on the device.
 *  - guest:   holds an activated Guest Pass (Sprint 5). The Supabase identity is
 *    created at activation time, not before.
 *  - member:  signed-in club member. The sign-in flow is intentionally not
 *    designed yet (phone-based / imported members — decided before Sprint 3).
 *
 * Sprint 2 has no real authentication: development builds can switch between
 * mock states from Profil → Développement. Release builds are always visitors.
 */
export type Session =
  | { kind: 'visitor' }
  | { kind: 'guest'; firstName: string | null }
  | { kind: 'member'; member: MemberProfile; guestPasses: GuestPassSummary };

export type SessionKind = Session['kind'];

type SessionContextValue = {
  session: Session;
  /** Dev-only mock switch; a no-op in release builds. */
  setMockKind: (kind: SessionKind) => void;
  signOut: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

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

export function SessionProvider({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<SessionKind>(__DEV__ ? 'member' : 'visitor');

  const value = useMemo<SessionContextValue>(
    () => ({
      session: mockSession(kind),
      setMockKind: (next) => {
        if (__DEV__) setKind(next);
      },
      signOut: () => setKind('visitor'),
    }),
    [kind],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
