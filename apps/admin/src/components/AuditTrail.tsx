'use client';

import { AUDIT_LABEL, changedFields } from '@/lib/admin/audit';
import { useAudit } from '@/lib/admin/hooks';
import { formatInstant } from '@/lib/dates';

import { useCan } from './Staff';

/** Change history of one entity (admins). */
export function AuditTrail({ entityId }: { entityId: string }) {
  const audit = useAudit(entityId, useCan('audit'));
  if (!audit.data?.length) return null;
  return (
    <section className="card">
      <h2 style={{ marginBottom: 8 }}>Historique</h2>
      <div className="timeline">
        {audit.data.map((e) => (
          <div className="step" key={e.id}>
            <span className="mark on" />
            <span>
              {AUDIT_LABEL[e.action] ?? e.action}
              {changedFields(e.summary) && (
                <span className="faint small"> · {changedFields(e.summary)}</span>
              )}
            </span>
            <span className="muted small">
              {formatInstant(e.created_at)} · {e.actor ?? 'Système'}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
