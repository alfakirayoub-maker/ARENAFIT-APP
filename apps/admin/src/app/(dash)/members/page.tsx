'use client';

import { useState } from 'react';

import { RequireCapability } from '@/components/Staff';
import { Badge, Empty, LoadError, PageHeader, Skeleton } from '@/components/ui';
import { useMembers } from '@/lib/admin/hooks';
import { formatDate } from '@/lib/dates';

const STATUS: Record<string, { label: string; tone: 'success' | 'neutral' | 'warning' }> = {
  active: { label: 'Actif', tone: 'success' },
  expired: { label: 'Expiré', tone: 'neutral' },
  suspended: { label: 'Suspendu', tone: 'warning' },
};

/** Read-only member list (safe fields). Member sign-in / import comes later. */
function MembersPageContent() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const members = useMembers(query);
  return (
    <>
      <PageHeader title="Membres" subtitle="Consultation uniquement. L’import et la connexion des membres arriveront dans un prochain sprint." />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search);
        }}>
        <input className="input" style={{ maxWidth: 300 }} placeholder="Rechercher un membre" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher" />
      </form>
      {members.isError ? (
        <LoadError onRetry={() => members.refetch()} />
      ) : !members.data ? (
        <Skeleton height={240} />
      ) : members.data.length === 0 ? (
        <section className="card">
          <Empty>Aucun membre enregistré pour le moment.</Empty>
        </section>
      ) : (
        <section className="card pad-0 table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Membre</th>
                <th>Abonnement</th>
                <th>Statut</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Pass disponibles</th>
                <th>Invitations</th>
              </tr>
            </thead>
            <tbody>
              {members.data.map((m) => {
                const st = m.membership_status ? STATUS[m.membership_status] : null;
                return (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{[m.first_name, m.last_name].filter(Boolean).join(' ') || '—'}</td>
                    <td className="muted">{m.plan_name ?? '—'}</td>
                    <td>{st ? <Badge tone={st.tone}>{st.label}</Badge> : <span className="faint">—</span>}</td>
                    <td className="muted small">{m.starts_on ? formatDate(m.starts_on) : '—'}</td>
                    <td className="muted small">{m.ends_on ? formatDate(m.ends_on) : 'Sans fin'}</td>
                    <td className="mono">
                      {m.available} / {m.allowance}
                    </td>
                    <td className="mono">{m.invitations}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

/** Gate first: the page's queries only run for roles allowed to see it. */
export default function MembersPage() {
  return (
    <RequireCapability capability="members">
      <MembersPageContent />
    </RequireCapability>
  );
}
