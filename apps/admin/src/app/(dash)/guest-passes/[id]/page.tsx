'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RequireCapability, useCan } from '@/components/Staff';
import { Badge, Button, LoadError, Notice, PageHeader, Skeleton } from '@/components/ui';
import { cancelInvitation } from '@/lib/admin/guest-passes';
import { keys, useAction, useInvitation } from '@/lib/admin/hooks';
import { formatInstant } from '@/lib/dates';
import { EVENT_LABEL, INVITATION_STATUS, OUTCOME_LABEL } from '@/lib/labels';

/** Safe lifecycle of one invitation — never tokens, codes or hashes. */
function GuestPassDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canCancel = useCan('guestPassCancel');
  const inv = useInvitation(id);
  const [confirm, setConfirm] = useState(false);
  const cancel = useAction((db) => cancelInvitation(db, id), {
    success: 'Invitation annulée · Pass rendu au membre',
    invalidate: [keys.invitation(id), keys.invitationsAll],
    onSuccess: () => setConfirm(false),
  });

  const d = inv.data;
  const steps = d
    ? [
        { label: 'Créée', at: d.created_at },
        { label: 'Partagée', at: d.last_shared_at },
        { label: 'Pass activé par l’invité', at: d.activated_at },
        { label: `Utilisé à l’accueil${d.reception_station_name ? ` · ${d.reception_station_name}` : ''}`, at: d.redeemed_at },
        ...(d.expired_at ? [{ label: 'Expirée', at: d.expired_at }] : []),
        ...(d.cancelled_at ? [{ label: 'Annulée', at: d.cancelled_at }] : []),
        ...(!d.expired_at && !d.cancelled_at && !d.redeemed_at ? [{ label: 'Expire le', at: d.expires_at, future: true }] : []),
      ]
    : [];

  return (
    <>
      {inv.isError ? (
        <LoadError onRetry={() => inv.refetch()} />
      ) : inv.data === undefined ? (
        <Skeleton height={400} />
      ) : !d ? (
        <Notice>Invitation introuvable.</Notice>
      ) : (
        <>
          <PageHeader
            title={`${d.inviter_name ?? 'Membre'} → ${d.invitee_name ?? 'invité'}`}
            subtitle={<Badge tone={INVITATION_STATUS[d.status].tone}>{INVITATION_STATUS[d.status].label}</Badge>}
            actions={
              <>
                <Button variant="ghost" onClick={() => router.push('/guest-passes')}>
                  Retour
                </Button>
                {canCancel && d.status === 'sent' && (
                  <Button variant="danger" onClick={() => setConfirm(true)}>
                    Annuler l’invitation
                  </Button>
                )}
              </>
            }
          />
          <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            <section className="card">
              <h2 style={{ marginBottom: 8 }}>Cycle de vie</h2>
              <div className="timeline">
                {steps.map((s) => (
                  <div className="step" key={s.label}>
                    <span className={`mark${s.at && !('future' in s) ? ' on' : ''}`} />
                    <span className={s.at ? '' : 'faint'}>{s.label}</span>
                    <span className="muted small">{s.at ? formatInstant(s.at) : '—'}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="card">
              <h2 style={{ marginBottom: 8 }}>Événements</h2>
              <div className="timeline">
                {d.events.map((e, i) => (
                  <div className="step" key={i}>
                    <span className="mark on" />
                    <span>
                      {EVENT_LABEL[e.event] ?? e.event}
                      {e.outcome && <span className="faint small"> · {OUTCOME_LABEL[e.outcome] ?? e.outcome}</span>}
                      {e.station_name && <span className="faint small"> · {e.station_name}</span>}
                    </span>
                    <span className="muted small">{formatInstant(e.created_at)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <p className="faint small">Les liens, codes et QR ne sont jamais affichés : seuls leurs empreintes sont conservées.</p>
          <ConfirmDialog
            open={confirm}
            title="Annuler cette invitation ?"
            confirmLabel="Annuler l’invitation"
            busy={cancel.isPending}
            onClose={() => setConfirm(false)}
            onConfirm={() => cancel.mutate(undefined)}>
            <p className="muted">Le lien et le code cessent de fonctionner et le Pass revient dans le solde du membre.</p>
          </ConfirmDialog>
        </>
      )}
    </>
  );
}

/** Gate first: the page's queries only run for roles allowed to see it. */
export default function GuestPassDetail() {
  return (
    <RequireCapability capability="guestPasses">
      <GuestPassDetailContent />
    </RequireCapability>
  );
}
