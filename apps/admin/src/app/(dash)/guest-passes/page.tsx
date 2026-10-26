'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { RequireCapability } from '@/components/Staff';
import { Badge, Empty, LoadError, PageHeader, Skeleton } from '@/components/ui';
import { INVITATION_STATUSES, type InvitationStatus } from '@/lib/admin/guest-passes';
import { useInvitations } from '@/lib/admin/hooks';
import { formatInstant } from '@/lib/dates';
import { INVITATION_STATUS } from '@/lib/labels';

/** Guest passes: safe operational view (no tokens, hashes or guest identities). */
function GuestPassesPageContent() {
  const router = useRouter();
  const [status, setStatus] = useState<InvitationStatus | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const list = useInvitations(status, query);

  return (
    <>
      <PageHeader title="Pass Invité" subtitle="Invitations envoyées par les membres et leur utilisation à l’accueil." />
      <div className="row">
        <div className="segmented" role="group" aria-label="Filtrer par statut">
          <button aria-pressed={status === null} onClick={() => setStatus(null)}>
            Tous
          </button>
          {INVITATION_STATUSES.filter((s) => s !== 'converted').map((s) => (
            <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)}>
              {INVITATION_STATUS[s].label}
            </button>
          ))}
        </div>
        <form
          className="row grow"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search);
          }}>
          <input className="input" style={{ maxWidth: 280 }} placeholder="Rechercher un membre ou un invité" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher" />
        </form>
      </div>
      {list.isError ? (
        <LoadError onRetry={() => list.refetch()} />
      ) : !list.data ? (
        <Skeleton height={300} />
      ) : list.data.length === 0 ? (
        <section className="card">
          <Empty>Aucune invitation.</Empty>
        </section>
      ) : (
        <section className="card pad-0 table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Membre</th>
                <th>Invité</th>
                <th>Statut</th>
                <th>Créée</th>
                <th>Activée</th>
                <th>Expire / expirée</th>
                <th>Utilisée</th>
                <th>Station</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((i) => (
                <tr key={i.id} className="link" onClick={() => router.push(`/guest-passes/${i.id}`)}>
                  <td style={{ fontWeight: 600 }}>{i.inviter_name ?? 'Membre'}</td>
                  <td>{i.invitee_name ?? <span className="faint">—</span>}</td>
                  <td>
                    <Badge tone={INVITATION_STATUS[i.status].tone}>{INVITATION_STATUS[i.status].label}</Badge>
                  </td>
                  <td className="muted small">{formatInstant(i.created_at)}</td>
                  <td className="muted small">{formatInstant(i.activated_at)}</td>
                  <td className="muted small">{formatInstant(i.expired_at ?? i.expires_at)}</td>
                  <td className="muted small">{formatInstant(i.redeemed_at)}</td>
                  <td className="muted small">{i.reception_station_name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

/** Gate first: the page's queries only run for roles allowed to see it. */
export default function GuestPassesPage() {
  return (
    <RequireCapability capability="guestPasses">
      <GuestPassesPageContent />
    </RequireCapability>
  );
}
