'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';

import type { StaffIdentity } from '@/lib/admin/identity';
import { AdminError } from '@/lib/errors';
import { can, type Capability } from '@/lib/roles';

import { ToastProvider } from './Toast';
import { Notice } from './ui';

const StaffContext = createContext<StaffIdentity | null>(null);

export function useStaff(): StaffIdentity {
  const s = useContext(StaffContext);
  if (!s) throw new Error('useStaff outside <Providers>');
  return s;
}

export function useCan(capability: Capability): boolean {
  return can(useStaff().role, capability);
}

export function Providers({ identity, children }: { identity: StaffIdentity; children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            // Permission and validation errors don't fix themselves.
            retry: (n, e) => !(e instanceof AdminError && e.kind !== 'network') && n < 2,
          },
        },
      }),
  );
  return (
    <StaffContext.Provider value={identity}>
      <QueryClientProvider client={client}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </StaffContext.Provider>
  );
}

/** Page-level guard for navigation; the database enforces the same rules. */
export function RequireCapability({ capability, children }: { capability: Capability; children: ReactNode }) {
  const allowed = useCan(capability);
  if (!allowed) return <Notice tone="warning">Cette section n’est pas accessible avec votre rôle.</Notice>;
  return <>{children}</>;
}
