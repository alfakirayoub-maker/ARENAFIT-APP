'use client';

import { RequireCapability } from '@/components/Staff';
import { LoadError, PageHeader, Skeleton } from '@/components/ui';
import { AUDIT_LABEL, changedFields } from '@/lib/admin/audit';
import { useAudit } from '@/lib/admin/hooks';
import { formatInstant } from '@/lib/dates';
import { ROLE_LABEL, isStaffRole } from '@/lib/roles';

const ENTITY: Record<string, string> = {
  class_session: 'Planning',
  news: 'Actualités',
  coach: 'Coachs',
  activity: 'Activités',
  reception_station: 'Stations',
  guest_invitation: 'Pass Invité',
};

/** Who did what, when (no secrets are ever logged). */
function AuditPageContent() {
  const audit = useAudit(undefined, true);
  return (
    <>
      <PageHeader title="Journal des actions" subtitle="200 dernières actions importantes. Aucun secret n’est enregistré." />
      {audit.isError ? (
        <LoadError onRetry={() => audit.refetch()} />
      ) : !audit.data ? (
        <Skeleton height={300} />
      ) : (
        <section className="card pad-0 table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>Élément</th>
                <th>Détail</th>
                <th>Par</th>
              </tr>
            </thead>
            <tbody>
              {audit.data.map((e) => {
                const s = e.summary;
                const detail = [s.name, s.title, s.activity, s.date && `${s.date} ${s.start ?? ''}`, changedFields(s) && `champs : ${changedFields(s)}`, typeof s.created === 'number' && `${s.created} copie(s)`]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <tr key={e.id}>
                    <td className="muted small mono" style={{ whiteSpace: 'nowrap' }}>
                      {formatInstant(e.created_at)}
                    </td>
                    <td>{AUDIT_LABEL[e.action] ?? e.action}</td>
                    <td className="muted">{ENTITY[e.entity_type] ?? e.entity_type}</td>
                    <td className="muted small">{detail}</td>
                    <td className="small">
                      {e.actor ?? 'Système'}
                      {e.actor_role && isStaffRole(e.actor_role) && <span className="faint"> · {ROLE_LABEL[e.actor_role]}</span>}
                    </td>
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
export default function AuditPage() {
  return (
    <RequireCapability capability="audit">
      <AuditPageContent />
    </RequireCapability>
  );
}
