import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { SignOutButton } from '@/components/SignOutButton';
import { Sidebar } from '@/components/Sidebar';
import { Providers } from '@/components/Staff';
import { Logo } from '@/components/Logo';
import { getStaffIdentity } from '@/lib/admin/identity';
import { getServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Every dashboard page: a signed-in user WITH a staff role (checked in the
 * database via admin_whoami). Data access is still enforced by RLS.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const db = await getServerClient();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect('/login');

  const identity = await getStaffIdentity(db).catch(() => null);
  if (!identity) {
    return (
      <main className="login">
        <div className="panel">
          <div className="center">
            <Logo height={56} />
          </div>
          <div className="card">
            <h1 style={{ fontSize: 20 }}>Accès refusé</h1>
            <p className="muted">Ce compte n’a pas de rôle dans le tableau de bord Arena Fit. Contactez un administrateur.</p>
            <SignOutButton />
          </div>
        </div>
      </main>
    );
  }

  return (
    <Providers identity={identity}>
      <div className="shell">
        <Sidebar />
        <main className="main">
          <div className="content">{children}</div>
        </main>
      </div>
    </Providers>
  );
}
