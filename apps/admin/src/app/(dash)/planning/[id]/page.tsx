'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { AuditTrail } from '@/components/AuditTrail';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DuplicateDialog } from '@/components/DuplicateDialog';
import { ImageField } from '@/components/ImageField';
import { RequireCapability, useCan } from '@/components/Staff';
import { Badge, Button, Field, LoadError, Notice, PageHeader, Skeleton } from '@/components/ui';
import { keys, useAction, useActivities, useCoachActivityMap, useCoaches, useRooms, useSession } from '@/lib/admin/hooks';
import { cancelSession, createSession, deleteSession, restoreSession, updateSession, type SessionRow } from '@/lib/admin/planning';
import { clubToday, formatDayLong, hhmm, weekStart } from '@/lib/dates';
import { LEVEL_LABEL, VISIBILITY_LABEL } from '@/lib/labels';
import { coachActivityWarning, suggestEndTime } from '@/lib/planning-rules';
import { fieldErrors, LEVELS, sessionSchema, VISIBILITIES, type SessionInput } from '@/lib/validation';

function emptySession(date: string): SessionInput {
  return {
    activity_id: '',
    coach_id: null,
    room_id: null,
    session_date: date,
    start_time: '18:00',
    end_time: '19:00',
    level: 'all_levels',
    visibility: 'public',
    description: '',
    image_path: null,
  };
}

function fromRow(s: SessionRow): SessionInput {
  return {
    activity_id: s.activity_id,
    coach_id: s.coach_id,
    room_id: s.room_id,
    session_date: s.session_date,
    start_time: hhmm(s.start_time),
    end_time: hhmm(s.end_time),
    level: s.level,
    visibility: s.visibility,
    description: s.description ?? '',
    image_path: s.image_path,
  };
}

function SessionEditor({ id, initial, row }: { id: string | null; initial: SessionInput; row?: SessionRow }) {
  const router = useRouter();
  const isAdmin = useCan('audit');
  const activities = useActivities();
  const coaches = useCoaches();
  const rooms = useRooms();
  const pairs = useCoachActivityMap();
  const [v, setV] = useState<SessionInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null);
  const [cancelNote, setCancelNote] = useState('');
  const [duplicating, setDuplicating] = useState(false);

  const set = <K extends keyof SessionInput>(k: K, value: SessionInput[K]) => setV((x) => ({ ...x, [k]: value }));
  const invalidate = [keys.sessionsAll, ...(id ? [keys.session(id), keys.audit(id)] : [])];
  const back = () => router.push(`/planning?week=${weekStart(v.session_date as string)}`);

  const save = useAction((db, input: SessionInput) => (id ? updateSession(db, id, input).then(() => id) : createSession(db, input)), {
    success: id ? 'Cours enregistré' : 'Cours créé',
    invalidate,
    onSuccess: (newId) => (id ? undefined : router.replace(`/planning/${newId}`)),
  });
  const cancel = useAction((db, note: string) => cancelSession(db, id!, note), {
    success: 'Cours annulé — les membres le voient « Annulé » et leurs rappels sont retirés.',
    invalidate,
    onSuccess: () => setConfirm(null),
  });
  const restore = useAction((db) => restoreSession(db, id!), { success: 'Cours rétabli', invalidate });
  const remove = useAction((db) => deleteSession(db, id!), { success: 'Cours supprimé', invalidate, onSuccess: back });

  const submit = () => {
    const parsed = sessionSchema.safeParse(v);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    save.mutate(v);
  };

  const activity = activities.data?.find((a) => a.id === v.activity_id);
  const warning = coachActivityWarning(pairs.data, v.coach_id, v.activity_id || null);

  return (
    <>
      <PageHeader
        title={id ? `${activity?.name ?? 'Cours'} · ${formatDayLong(v.session_date as string)}` : 'Nouveau cours'}
        subtitle={
          row?.is_cancelled ? (
            <Badge tone="danger">Annulé{row.cancellation_note ? ` — ${row.cancellation_note}` : ''}</Badge>
          ) : (
            'Heures du club (Casablanca), telles qu’affichées dans l’application.'
          )
        }
        actions={
          <>
            <Button variant="ghost" onClick={back}>
              Retour au planning
            </Button>
            {id && (
              <Button onClick={() => setDuplicating(true)} disabled={!row}>
                Dupliquer
              </Button>
            )}
          </>
        }
      />

      <section className="card">
        <div className="form">
          <Field label="Activité" htmlFor="activity" error={errors.activity_id}>
            <select
              id="activity"
              className="select"
              value={v.activity_id}
              aria-invalid={!!errors.activity_id}
              onChange={(e) => {
                const next = activities.data?.find((a) => a.id === e.target.value);
                setV((x) => ({
                  ...x,
                  activity_id: e.target.value,
                  end_time: (!id && suggestEndTime(x.start_time as string, next?.default_duration_min)) || x.end_time,
                }));
              }}>
              <option value="">Choisir…</option>
              {(activities.data ?? []).map((a) => (
                <option key={a.id} value={a.id} disabled={!a.is_active && a.id !== v.activity_id}>
                  {a.name}
                  {a.is_active ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Coach" htmlFor="coach">
            <select id="coach" className="select" value={v.coach_id ?? ''} onChange={(e) => set('coach_id', e.target.value || null)}>
              <option value="">À définir</option>
              {(coaches.data ?? []).map((c) => (
                <option key={c.id} value={c.id} disabled={!c.is_active && c.id !== v.coach_id}>
                  {c.display_name}
                  {c.is_active ? '' : ' (inactif)'}
                </option>
              ))}
            </select>
          </Field>
          {warning && (
            <div className="full">
              <Notice tone="warning">{warning}</Notice>
            </div>
          )}
          <Field label="Date" htmlFor="date" error={errors.session_date}>
            <input id="date" className="input" type="date" value={v.session_date} onChange={(e) => set('session_date', e.target.value)} />
          </Field>
          <Field label="Salle" htmlFor="room">
            <select id="room" className="select" value={v.room_id ?? ''} onChange={(e) => set('room_id', e.target.value || null)}>
              <option value="">Non précisée</option>
              {(rooms.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Début" htmlFor="start" error={errors.start_time} hint="Format 24 h, heure du club (ex. 18:30).">
            <input
              id="start"
              className="input mono"
              inputMode="numeric"
              placeholder="18:00"
              maxLength={5}
              autoComplete="off"
              value={v.start_time}
              onChange={(e) => set('start_time', e.target.value)}
            />
          </Field>
          <Field label="Fin" htmlFor="end" error={errors.end_time}>
            <input
              id="end"
              className="input mono"
              inputMode="numeric"
              placeholder="18:45"
              maxLength={5}
              autoComplete="off"
              value={v.end_time}
              onChange={(e) => set('end_time', e.target.value)}
            />
          </Field>
          <Field label="Niveau" htmlFor="level">
            <select id="level" className="select" value={v.level} onChange={(e) => set('level', e.target.value as SessionInput['level'])}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Visibilité" htmlFor="visibility" hint="« Masqué » retire le cours de l’application.">
            <select
              id="visibility"
              className="select"
              value={v.visibility}
              onChange={(e) => set('visibility', e.target.value as SessionInput['visibility'])}>
              {VISIBILITIES.map((x) => (
                <option key={x} value={x}>
                  {VISIBILITY_LABEL[x]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description (facultatif)" htmlFor="description" full hint="Remplace la description de l’activité pour ce cours uniquement." error={errors.description}>
            <textarea
              id="description"
              className="textarea"
              value={v.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              style={{ minHeight: 90 }}
            />
          </Field>
          <ImageField
            bucket="classes"
            folder="sessions"
            label="Image spécifique (facultatif)"
            value={v.image_path}
            onChange={(k) => set('image_path', k)}
          />
        </div>
        <div className="form-actions">
          {id && row && !row.is_cancelled && (
            <Button variant="danger" onClick={() => setConfirm('cancel')}>
              Annuler le cours
            </Button>
          )}
          {id && row?.is_cancelled && (
            <Button onClick={() => restore.mutate(undefined)} loading={restore.isPending}>
              Rétablir le cours
            </Button>
          )}
          {id && (
            <Button variant="ghost" onClick={() => setConfirm('delete')}>
              Supprimer
            </Button>
          )}
          <span className="grow" />
          <Button variant="primary" onClick={submit} loading={save.isPending}>
            {id ? 'Enregistrer' : 'Créer le cours'}
          </Button>
        </div>
      </section>

      {id && isAdmin && <AuditTrail entityId={id} />}

      <ConfirmDialog
        open={confirm === 'cancel'}
        title="Annuler ce cours ?"
        confirmLabel="Annuler le cours"
        busy={cancel.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => cancel.mutate(cancelNote)}>
        <p className="muted">
          Le cours reste visible dans l’application avec la mention « Annulé ». Les rappels des membres sont retirés à leur
          prochaine synchronisation.
        </p>
        <Field label="Motif (facultatif)" htmlFor="note">
          <input id="note" className="input" value={cancelNote} maxLength={120} onChange={(e) => setCancelNote(e.target.value)} />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Supprimer définitivement ce cours ?"
        confirmLabel="Supprimer"
        busy={remove.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => remove.mutate(undefined)}>
        <p className="muted">Préférez « Annuler le cours » pour prévenir les membres. La suppression le retire sans mention.</p>
      </ConfirmDialog>
      {id && row && <DuplicateDialog open={duplicating} session={row} onClose={() => setDuplicating(false)} />}
    </>
  );
}

function Editor() {
  const { id: param } = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = param === 'new' ? null : param;
  const session = useSession(id);
  if (!id) {
    const date = search.get('date');
    return <SessionEditor id={null} initial={emptySession(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : clubToday())} />;
  }
  if (session.isError) return <LoadError onRetry={() => session.refetch()} />;
  if (!session.data) return <Skeleton height={420} />;
  return <SessionEditor key={session.data.id + session.dataUpdatedAt} id={id} initial={fromRow(session.data)} row={session.data} />;
}

function SessionPageContent() {
  return (
    <>
      <Suspense fallback={<Skeleton height={420} />}>
        <Editor />
      </Suspense>
    </>
  );
}

/** Gate first: the page's queries only run for roles allowed to see it. */
export default function SessionPage() {
  return (
    <RequireCapability capability="planning">
      <SessionPageContent />
    </RequireCapability>
  );
}
