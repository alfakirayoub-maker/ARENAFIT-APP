'use client';

import Link from 'next/link';

import { useCan } from '@/components/Staff';
import { Badge, LoadError, PageHeader, Skeleton } from '@/components/ui';
import { AUDIT_LABEL } from '@/lib/admin/audit';
import { useAudit, useStats } from '@/lib/admin/hooks';
import { formatDayLong, formatInstant } from '@/lib/dates';

/** Overview: only metrics the backend really tracks. */
export default function DashboardHome() {
  const stats = useStats();
  const isAdmin = useCan('audit');
  const canPlanning = useCan('planning');
  const canPasses = useCan('guestPasses');
  const audit = useAudit(undefined, isAdmin);
  const s = stats.data;

  const cards: { label: string; value: number | null | undefined; href?: string; show: boolean }[] = [
    { label: 'Cours aujourd’hui', value: s?.sessions_today, href: canPlanning ? '/planning' : undefined, show: true },
    { label: 'Cours cette semaine', value: s?.sessions_week, href: canPlanning ? '/planning' : undefined, show: true },
    { label: 'Actualités publiées', value: s?.news_published, href: '/news', show: canPlanning },
    { label: 'Pass Invité activés', value: s?.passes_active, href: '/guest-passes', show: canPasses },
    { label: 'Pass utilisés aujourd’hui', value: s?.passes_used_today, href: '/guest-passes', show: canPasses },
    { label: 'Invitations en cours', value: s?.invitations_pending, href: '/guest-passes', show: canPasses },
  ];

  return (
    <>
      <PageHeader title="Tableau de bord" subtitle={s ? `Aujourd’hui, ${formatDayLong(s.club_today)} (heure du club)` : ' '} />
      {stats.isError ? (
        <LoadError onRetry={() => stats.refetch()} />
      ) : (
        <div className="cards">
          {cards
            .filter((c) => c.show)
            .map((c) => {
              const body = (
                <div className="card stat">
                  <span className="label">{c.label}</span>
                  {c.value == null ? <Skeleton height={36} /> : <span className="value">{c.value}</span>}
                </div>
              );
              return c.href ? (
                <Link key={c.label} href={c.href}>
                  {body}
                </Link>
              ) : (
                <div key={c.label}>{body}</div>
              );
            })}
          {canPasses && (
            <div className="card stat unavailable" title="Le suivi des conversions invité → membre n’existe pas encore.">
              <span className="label">Conversions invités</span>
              <span className="value">Bientôt disponible</span>
            </div>
          )}
        </div>
      )}

      {s && s.cancelled_week > 0 && canPlanning && (
        <p className="muted">
          <Badge tone="danger">{s.cancelled_week}</Badge> cours annulé(s) cette semaine.
        </p>
      )}

      {isAdmin && (
        <section className="card pad-0">
          <div className="row" style={{ padding: '14px 18px' }}>
            <h2 className="grow">Activité récente</h2>
            <Link href="/audit" className="muted small">
              Tout le journal →
            </Link>
          </div>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {(audit.data ?? []).slice(0, 8).map((e) => (
                  <tr key={e.id}>
                    <td style={{ width: 170 }} className="muted mono small">
                      {formatInstant(e.created_at)}
                    </td>
                    <td>{AUDIT_LABEL[e.action] ?? e.action}</td>
                    <td className="muted">{String(e.summary.name ?? e.summary.title ?? e.summary.activity ?? '')}</td>
                    <td className="muted small">{e.actor ?? 'Système'}</td>
                  </tr>
                ))}
                {audit.data?.length === 0 && (
                  <tr>
                    <td className="muted">Aucune action enregistrée.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
