import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { authProvider } from './providers';
import type { AuthProvider, Session, SessionKind } from './types';

export type { Session, SessionKind } from './types';

type SessionContextValue = {
  session: Session;
  /** Development only (mock provider); undefined in release builds. */
  setMockKind?: (kind: SessionKind) => void;
  signOut: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children, provider = authProvider }: { children: ReactNode; provider?: AuthProvider }) {
  // Everyone starts as a visitor; the provider may restore a richer session.
  const [session, setSession] = useState<Session>({ kind: 'visitor' });

  useEffect(() => {
    let cancelled = false;
    provider
      .restore()
      .then((s) => !cancelled && setSession(s))
      .catch(() => {}); // stay a visitor
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      setMockKind: provider.mock ? (kind) => setSession(provider.mock!(kind)) : undefined,
      signOut: () => {
        void provider.signOut().finally(() => setSession({ kind: 'visitor' }));
      },
    }),
    [session, provider],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
