'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { keys, useAction } from '@/lib/admin/hooks';
import { duplicateSession, type SessionRow } from '@/lib/admin/planning';
import { addDays, formatDayLong, hhmm, repeatDates } from '@/lib/dates';
import { normalizeDuplicateDates } from '@/lib/planning-rules';

import { Badge, Button, Field } from './ui';

/** Copy a session to other dates (same times, coach, room, settings). */
export function DuplicateDialog({ open, session, onClose }: { open: boolean; session: SessionRow; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [dates, setDates] = useState<string[]>([]);
  const [pick, setPick] = useState(addDays(session.session_date, 1));
  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) d.showModal();
    if (!open && d?.open) d.close();
  }, [open]);

  const chosen = normalizeDuplicateDates(dates, session.session_date);
  const action = useAction((db, list: string[]) => duplicateSession(db, session.id, list), {
    invalidate: [keys.sessionsAll],
    success: (r) =>
      `${r.created.length} cours créé(s)${r.skipped.length ? ` · ${r.skipped.length} date(s) déjà planifiée(s) ignorée(s)` : ''}`,
    onSuccess: () => {
      setDates([]);
      onClose();
      router.refresh();
    },
  });

  return (
    <dialog ref={ref} className="modal" onClose={onClose} aria-labelledby="dup-title">
      <div className="modal-body">
        <h2 id="dup-title">Dupliquer ce cours</h2>
        <p className="muted">
          {session.activity?.name} · {hhmm(session.start_time)}–{hhmm(session.end_time)} · {session.coach?.display_name ?? 'coach à définir'}
        </p>
        <div className="row">
          <Button size="sm" onClick={() => setDates((d) => [...d, addDays(session.session_date, 7)])}>
            Semaine suivante
          </Button>
          <Button size="sm" onClick={() => setDates((d) => [...d, ...repeatDates(session.session_date, 7, 4)])}>
            4 semaines suivantes
          </Button>
          <Button size="sm" onClick={() => setDates((d) => [...d, addDays(session.session_date, 1)])}>
            Lendemain
          </Button>
        </div>
        <Field label="Ajouter une date" htmlFor="dup-date">
          <div className="row">
            <input id="dup-date" className="input" type="date" value={pick} onChange={(e) => setPick(e.target.value)} style={{ width: 200 }} />
            <Button size="sm" onClick={() => setDates((d) => [...d, pick])}>
              Ajouter
            </Button>
          </div>
        </Field>
        <div className="row" aria-live="polite">
          {chosen.length === 0 ? (
            <span className="faint">Aucune date choisie.</span>
          ) : (
            chosen.map((d) => (
              <button key={d} className="badge accent" onClick={() => setDates((x) => x.filter((y) => y !== d))} title="Retirer">
                {formatDayLong(d)} ×
              </button>
            ))
          )}
        </div>
        {chosen.length > 0 && (
          <p className="faint small">
            <Badge>{chosen.length}</Badge> copie(s). Une date qui a déjà ce cours à la même heure est ignorée.
          </p>
        )}
      </div>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onClose}>
          Fermer
        </Button>
        <Button variant="primary" disabled={chosen.length === 0} loading={action.isPending} onClick={() => action.mutate(chosen)}>
          Dupliquer
        </Button>
      </div>
    </dialog>
  );
}
