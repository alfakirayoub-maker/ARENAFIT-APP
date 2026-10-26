'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { can, ROLE_LABEL, type Capability } from '@/lib/roles';
import { getBrowserClient } from '@/lib/supabase/browser';

import { Logo } from './Logo';
import { useStaff } from './Staff';
import { Button } from './ui';

const NAV: { href: string; label: string; cap: Capability; section?: string }[] = [
  { href: '/', label: 'Tableau de bord', cap: 'dashboard' },
  { href: '/planning', label: 'Planning', cap: 'planning', section: 'Contenu' },
  { href: '/activities', label: 'Activités', cap: 'activities' },
  { href: '/coaches', label: 'Coachs', cap: 'coaches' },
  { href: '/news', label: 'Actualités', cap: 'news' },
  { href: '/notifications', label: 'Notifications', cap: 'notifications' },
  { href: '/guest-passes', label: 'Pass Invité', cap: 'guestPasses', section: 'Accueil' },
  { href: '/stations', label: 'Stations réception', cap: 'stations' },
  { href: '/members', label: 'Membres', cap: 'members', section: 'Administration' },
  { href: '/audit', label: 'Journal', cap: 'audit' },
];

export function Sidebar() {
  const staff = useStaff();
  const pathname = usePathname();
  const router = useRouter();
  const items = NAV.filter((n) => can(staff.role, n.cap)).map((n, i, all) => ({
    ...n,
    // Section title before the first visible item of each section.
    showSection: !!n.section && all.slice(0, i).every((p) => p.section !== n.section),
  }));

  const signOut = async () => {
    await getBrowserClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <aside className="sidebar">
      <div className="logo">
        <Link href="/" aria-label="Tableau de bord">
          <Logo height={34} />
        </Link>
      </div>
      <nav className="nav" aria-label="Navigation principale">
        {items.map((n) => {
          const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
          return (
            <div key={n.href} style={{ display: 'contents' }}>
              {n.showSection && <span className="section">{n.section}</span>}
              <Link href={n.href} aria-current={active ? 'page' : undefined}>
                {n.label}
              </Link>
            </div>
          );
        })}
      </nav>
      <div className="me">
        <div className="who">
          <div style={{ fontWeight: 600 }}>{staff.displayName ?? staff.email}</div>
          <div className="faint small">{ROLE_LABEL[staff.role]}</div>
        </div>
        <Button size="sm" variant="ghost" onClick={signOut}>
          Se déconnecter
        </Button>
      </div>
    </aside>
  );
}
