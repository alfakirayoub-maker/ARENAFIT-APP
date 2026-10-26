'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { AuditTrail } from '@/components/AuditTrail';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ImageField } from '@/components/ImageField';
import { RequireCapability, useCan } from '@/components/Staff';
import { Badge, Button, Field, LoadError, PageHeader, Skeleton } from '@/components/ui';
import { saveActivity, setActivityActive, type ActivityRow } from '@/lib/admin/catalogue';
import { keys, useAction, useActivity } from '@/lib/admin/hooks';
import { CATEGORY_LABEL } from '@/lib/labels';
import { activitySchema, CATEGORIES, fieldErrors, slugify } from '@/lib/validation';

type Draft = {
  slug: string;
  name: string;
  category: (typeof CATEGORIES)[number];
  short_description: string;
  description: string;
  intensity: number | null;
  default_duration_min: number | null;
  equipment: string;
  image_path: string | null;
  is_active: boolean;
  is_featured: boolean;
};

function ActivityEditor({ id, initial }: { id: string | null; initial: Draft }) {
  const router = useRouter();
  const isAdmin = useCan('audit');
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const set = <K extends keyof Draft>(k: K, value: Draft[K]) => setV((x) => ({ ...x, [k]: value }));
  const invalidate = [keys.activities, ...(id ? [keys.activity(id), keys.audit(id)] : [])];

  const save = useAction((db, d: Draft) => saveActivity(db, id, d), {
    success: 'Activité enregistrée',
    invalidate,
    onSuccess: (newId) => (id ? undefined : router.replace(`/activities/${newId}`)),
  });
  const toggle = useAction((db, active: boolean) => setActivityActive(db, id!, active), {
    success: () => (v.is_active ? 'Activité désactivée' : 'Activité réactivée'),
    invalidate,
    onSuccess: () => {
      setConfirmDeactivate(false);
      setV((x) => ({ ...x, is_active: !x.is_active }));
    },
  });
  const submit = () => {
    const parsed = activitySchema.safeParse(v);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    save.mutate(v);
  };
  const num = (s: string) => (s === '' ? null : Number(s));

  return (
    <>
      <PageHeader
        title={id ? v.name || 'Activité' : 'Nouvelle activité'}
        subtitle={id ? v.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive — masquée dans l’application</Badge> : undefined}
        actions={
          <Button variant="ghost" onClick={() => router.push('/activities')}>
            Retour
          </Button>
        }
      />
      <section className="card">
        <div className="form">
          <Field label="Nom" htmlFor="name" error={errors.name}>
            <input id="name" className="input" value={v.name} onChange={(e) => setV((x) => ({ ...x, name: e.target.value, slug: id ? x.slug : slugify(e.target.value) }))} />
          </Field>
          <Field label="Identifiant (URL)" htmlFor="slug" error={errors.slug} hint={id ? 'Ne pas modifier : utilisé dans les liens.' : undefined}>
            <input id="slug" className="input" value={v.slug} readOnly={!!id} onChange={(e) => set('slug', e.target.value)} />
          </Field>
          <Field label="Catégorie" htmlFor="category">
            <select id="category" className="select" value={v.category} onChange={(e) => set('category', e.target.value as Draft['category'])}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Intensité" htmlFor="intensity" error={errors.intensity}>
            <select id="intensity" className="select" value={v.intensity ?? ''} onChange={(e) => set('intensity', num(e.target.value))}>
              <option value="">Non précisée</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}/5
                </option>
              ))}
            </select>
          </Field>
          <Field label="Durée habituelle (min)" htmlFor="duration" error={errors.default_duration_min} hint="Pré-remplit l’heure de fin dans le planning.">
            <input
              id="duration"
              className="input"
              type="number"
              min={5}
              max={240}
              value={v.default_duration_min ?? ''}
              onChange={(e) => set('default_duration_min', num(e.target.value))}
            />
          </Field>
          <Field label="Matériel (séparé par des virgules)" htmlFor="equipment" error={errors.equipment}>
            <input id="equipment" className="input" value={v.equipment} onChange={(e) => set('equipment', e.target.value)} />
          </Field>
          <Field label="Description courte" htmlFor="short" full error={errors.short_description} hint="Une phrase, affichée sur les cartes.">
            <input id="short" className="input" value={v.short_description} onChange={(e) => set('short_description', e.target.value)} />
          </Field>
          <Field label="Description" htmlFor="description" full error={errors.description}>
            <textarea id="description" className="textarea" value={v.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <ImageField bucket="activities" folder="covers" label="Image de couverture" value={v.image_path} onChange={(k) => set('image_path', k)} />
          <label className="switch full">
            <input type="checkbox" checked={v.is_featured} onChange={(e) => set('is_featured', e.target.checked)} />
            Mettre en avant
          </label>
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
            {id ? 'Enregistrer' : 'Créer l’activité'}
          </Button>
        </div>
      </section>
      {id && isAdmin && <AuditTrail entityId={id} />}
      <ConfirmDialog
        open={confirmDeactivate}
        title={`Désactiver ${v.name} ?`}
        confirmLabel="Désactiver"
        busy={toggle.isPending}
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={() => toggle.mutate(false)}>
        <p className="muted">L’activité n’apparaîtra plus dans l’application. Les cours existants ne sont pas supprimés.</p>
      </ConfirmDialog>
    </>
  );
}

const toDraft = (a: ActivityRow): Draft => ({
  slug: a.slug,
  name: a.name,
  category: a.category,
  short_description: a.short_description ?? '',
  description: a.description ?? '',
  intensity: a.intensity,
  default_duration_min: a.default_duration_min,
  equipment: a.equipment.join(', '),
  image_path: a.image_path,
  is_active: a.is_active,
  is_featured: a.is_featured,
});

function ActivityPageContent() {
  const { id: param } = useParams<{ id: string }>();
  const id = param === 'new' ? null : param;
  const activity = useActivity(id);
  return (
    <>
      {!id ? (
        <ActivityEditor
          id={null}
          initial={{
            slug: '',
            name: '',
            category: 'fitness',
            short_description: '',
            description: '',
            intensity: null,
            default_duration_min: null,
            equipment: '',
            image_path: null,
            is_active: true,
            is_featured: false,
          }}
        />
      ) : activity.isError ? (
        <LoadError onRetry={() => activity.refetch()} />
      ) : !activity.data ? (
        <Skeleton height={400} />
      ) : (
        <ActivityEditor key={activity.dataUpdatedAt} id={id} initial={toDraft(activity.data)} />
      )}
    </>
  );
}

/** Gate first: the page's queries only run for roles allowed to see it. */
export default function ActivityPage() {
  return (
    <RequireCapability capability="activities">
      <ActivityPageContent />
    </RequireCapability>
  );
}
