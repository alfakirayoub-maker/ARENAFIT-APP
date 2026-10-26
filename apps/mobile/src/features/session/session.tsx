import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { queryClient } from '@/data/queries';

import { authProvider } from './providers';
import type { AuthProvider, DevSessionChoice, Session } from './types';

export type { DevSessionChoice, Session, SessionKind } from './types';

type SessionContextValue = {
  session: Session;
  /** False until the persisted session has been read. */
  restored: boolean;
  /** Re-reads the session (e.g. after a Guest Pass activation). */
  refresh: () => Promise<void>;
  signOut: () => void;
  /** Development only; undefined in release builds. */
  dev?: { kind: 'development' | 'staging'; choices: DevSessionChoice[]; select: (choice: DevSessionChoice) => Promise<void> };
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children, provider = authProvider }: { children: ReactNode; provider?: AuthProvider }) {
  // Everyone starts as a visitor; the provider may restore a richer session.
  const [session, setSession] = useState<Session>({ kind: 'visitor' });
  const [restored, setRestored] = useState(false);

  const apply = useCallback((next: Session) => {
    // Per-user data (invitations, guest pass) must never leak across sessions.
    queryClient.removeQueries({ queryKey: ['guest-pass'] });
    setSession(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await provider.restore());
    } catch {
      // keep the current session
    }
  }, [provider, apply]);

  useEffect(() => {
    let cancelled = false;
    provider
      .restore()
      .then((s) => !cancelled && setSession(s))
      .catch(() => {}) // stay a visitor
      .finally(() => !cancelled && setRestored(true));
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      restored,
      refresh,
      signOut: () => {
        void provider.signOut().finally(() => apply({ kind: 'visitor' }));
      },
      dev: provider.dev
        ? {
            kind: provider.dev.kind,
            choices: provider.dev.choices,
            select: async (choice) => apply(await provider.dev!.select(choice)),
          }
        : undefined,
    }),
    [session, restored, refresh, provider, apply],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
