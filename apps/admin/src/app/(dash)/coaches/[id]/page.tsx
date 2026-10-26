'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { AuditTrail } from '@/components/AuditTrail';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ImageField } from '@/components/ImageField';
import { RequireCapability, useCan } from '@/components/Staff';
import { Badge, Button, Field, LoadError, PageHeader, Skeleton } from '@/components/ui';
import { saveCoach, setCoachActive, type CoachRow } from '@/lib/admin/catalogue';
import { keys, useAction, useActivities, useCoach } from '@/lib/admin/hooks';
import { coachSchema, fieldErrors, slugify } from '@/lib/validation';

type Draft = { slug: string; display_name: string; bio: string; photo_path: string | null; is_active: boolean; sort_order: number; activity_ids: string[] };

function CoachEditor({ id, initial }: { id: string | null; initial: Draft }) {
  const router = useRouter();
  const isAdmin = useCan('audit');
  const activities = useActivities();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const invalidate = [keys.coaches, keys.coachActivities, ...(id ? [keys.coach(id), keys.audit(id)] : [])];

  const save = useAction((db, d: Draft) => saveCoach(db, id, d, d.activity_ids), {
    success: 'Coach enregistré',
    invalidate,
    onSuccess: (newId) => (id ? undefined : router.replace(`/coaches/${newId}`)),
  });
  const toggle = useAction((db, active: boolean) => setCoachActive(db, id!, active), {
    success: () => (v.is_active ? 'Coach désactivé' : 'Coach réactivé'),
    invalidate,
    onSuccess: () => {
      setConfirmDeactivate(false);
      setV((x) => ({ ...x, is_active: !x.is_active }));
    },
  });

  const submit = () => {
    const parsed = coachSchema.safeParse(v);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    save.mutate(v);
  };
  const toggleActivity = (aid: string) =>
    setV((x) => ({ ...x, activity_ids: x.activity_ids.includes(aid) ? x.activity_ids.filter((a) => a !== aid) : [...x.activity_ids, aid] }));

  return (
    <>
      <PageHeader
        title={id ? v.display_name || 'Coach' : 'Nouveau coach'}
        subtitle={id ? v.is_active ? <Badge tone="success">Actif</Badge> : <Badge>Inactif — masqué dans l’application</Badge> : undefined}
        actions={
          <Button variant="ghost" onClick={() => router.push('/coaches')}>
            Retour
          </Button>
        }
      />
      <section className="card">
        <div className="form">
          <Field label="Nom affiché" htmlFor="name" error={errors.display_name} hint="Tel qu’affiché dans l’application, ex. ANAS D.">
            <input
              id="name"
              className="input"
              value={v.display_name}
              onChange={(e) => setV((x) => ({ ...x, display_name: e.target.value, slug: id ? x.slug : slugify(e.target.value) }))}
            />
          </Field>
          <Field label="Identifiant (URL)" htmlFor="slug" error={errors.slug} hint={id ? 'Ne pas modifier : utilisé dans les liens.' : undefined}>
            <input id="slug" className="input" value={v.slug} readOnly={!!id} onChange={(e) => setV((x) => ({ ...x, slug: e.target.value }))} />
          </Field>
          <Field label="Présentation (facultatif)" htmlFor="bio" full error={errors.bio}>
            <textarea id="bio" className="textarea" value={v.bio} onChange={(e) => setV((x) => ({ ...x, bio: e.target.value }))} />
          </Field>
          <ImageField bucket="coaches" folder="photos" round label="Photo" value={v.photo_path} onChange={(k) => setV((x) => ({ ...x, photo_path: k }))} />
          <Field label="Activités enseignées" full hint="Utilisé pour la fiche coach et les alertes du planning.">
            <div className="checks">
              {(activities.data ?? []).map((a) => (
                <label key={a.id} className="check">
                  <input type="checkbox" checked={v.activity_ids.includes(a.id)} onChange={() => toggleActivity(a.id)} />
                  {a.name}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Ordre d’affichage" htmlFor="order">
            <input
              id="order"
              className="input"
              type="number"
              min={0}
              max={999}
              value={v.sort_order}
              onChange={(e) => setV((x) => ({ ...x, sort_order: Number(e.target.value) || 0 }))}
            />
          </Field>
        </div>
        <div className="form-actions">
          {id &&
            (v.is_active ? (
              <Button variant="danger" onClick={() => setConfirmDeactivate(true)}>
                Désactiver
              </Button>
            ) : (
              <Button onClick={() => toggle.mutate(true)} loading={toggle.isPending}>
                Réactiver
              </Button>
            ))}
          <span className="grow" />
          <Button variant="primary" onClick={submit} loading={save.isPending}>
            {id ? 'Enregistrer' : 'Créer le coach'}
          </Button>
        </div>
      </section>
      {id && isAdmin && <AuditTrail entityId={id} />}
      <ConfirmDialog
        open={confirmDeactivate}
        title={`Désactiver ${v.display_name} ?`}
        confirmLabel="Désactiver"
        busy={toggle.isPending}
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={() => toggle.mutate(false)}>
        <p className="muted">Le coach n’apparaîtra plus dans l’application. Ses cours passés et planifiés restent inchangés.</p>
      </ConfirmDialog>
    </>
  );
}

const toDraft = (c: CoachRow): Draft => ({ ...c, bio: c.bio ?? '' });

function CoachPageContent() {
  const { id: param } = useParams<{ id: string }>();
  const id = param === 'new' ? null : param;
  const coach = useCoach(id);
  return (
    <>
      {!id ? (
        <CoachEditor id={null} initial={{ slug: '', display_name: '', bio: '', photo_path: null, is_active: true, sort_order: 0, activity_ids: [] }} />
      ) : coach.isError ? (
        <LoadError onRetry={() => coach.refetch()} />
      ) : !coach.data ? (
        <Skeleton height={400} />
      ) : (
        <CoachEditor key={coach.dataUpdatedAt} id={id} initial={toDraft(coach.data)} />
      )}
    </>
  );
}

/** Gate first: the page's queries only run for roles allowed to see it. */
export default function CoachPage() {
  return (
    <RequireCapability capability="coaches">
      <CoachPageContent />
    </RequireCapability>
  );
}
