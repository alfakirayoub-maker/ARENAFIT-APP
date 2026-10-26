'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { AuditTrail } from '@/components/AuditTrail';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ImageField } from '@/components/ImageField';
import { RequireCapability, useCan } from '@/components/Staff';
import { Badge, Button, Field, LoadError, Notice, PageHeader, Skeleton } from '@/components/ui';
import { clubInstant } from '@/lib/club-clock';
import { clubToday, formatInstant } from '@/lib/dates';
import { keys, useAction, useNewsItem } from '@/lib/admin/hooks';
import { newsState, publishNews, saveNews, unpublishNews, type NewsRow } from '@/lib/admin/news';
import { NEWS_CATEGORY_LABEL, NEWS_STATE_BADGE as STATE_BADGE } from '@/lib/labels';
import { fieldErrors, NEWS_CATEGORIES, newsSchema, slugify } from '@/lib/validation';

type Draft = { slug: string; category: (typeof NEWS_CATEGORIES)[number]; title: string; excerpt: string; body: string; cover_path: string | null };

function NewsEditor({ id, initial, row }: { id: string | null; initial: Draft; row?: NewsRow }) {
  const router = useRouter();
  const isAdmin = useCan('audit');
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(clubToday());
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const set = <K extends keyof Draft>(k: K, value: Draft[K]) => setV((x) => ({ ...x, [k]: value }));
  const state = row ? newsState(row) : 'draft';
  const invalidate = [keys.news, ...(id ? [keys.newsItem(id), keys.audit(id)] : [])];

  const validate = () => {
    const parsed = newsSchema.safeParse(v);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return false;
    }
    setErrors({});
    return true;
  };

  const save = useAction((db, d: Draft) => saveNews(db, id, d), {
    success: 'Article enregistré',
    invalidate,
    onSuccess: (newId) => (id ? undefined : router.replace(`/news/${newId}`)),
  });
  /** Saves the content, then publishes now or at a club-local date/time. */
  const publish = useAction(
    async (db, at: Date | null) => {
      const savedId = await saveNews(db, id, v);
      await publishNews(db, savedId, at ?? new Date());
      return savedId;
    },
    {
      success: () => 'Article publié',
      invalidate,
      onSuccess: (newId) => (id ? undefined : router.replace(`/news/${newId}`)),
    },
  );
  const unpublish = useAction((db) => unpublishNews(db, id!), {
    success: 'Article retiré de l’application',
    invalidate,
    onSuccess: () => setConfirmUnpublish(false),
  });

  const scheduleAt = (() => {
    try {
      return clubInstant(scheduleDate, scheduleTime);
    } catch {
      return null;
    }
  })();

  return (
    <>
      <PageHeader
        title={id ? v.title || 'Article' : 'Nouvel article'}
        subtitle={
          row ? (
            <span className="row">
              <Badge tone={STATE_BADGE[state].tone}>{STATE_BADGE[state].label}</Badge>
              {row.published_at && <span className="muted small">{formatInstant(row.published_at)}</span>}
            </span>
          ) : undefined
        }
        actions={
          <Button variant="ghost" onClick={() => router.push('/news')}>
            Retour
          </Button>
        }
      />
      <section className="card">
        <div className="form">
          <Field label="Titre" htmlFor="title" full error={errors.title}>
            <input id="title" className="input" value={v.title} onChange={(e) => setV((x) => ({ ...x, title: e.target.value, slug: id ? x.slug : slugify(e.target.value) }))} />
          </Field>
          <Field label="Catégorie" htmlFor="category">
            <select id="category" className="select" value={v.category} onChange={(e) => set('category', e.target.value as Draft['category'])}>
              {NEWS_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {NEWS_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Identifiant (URL)" htmlFor="slug" error={errors.slug} hint={id ? 'Ne pas modifier : utilisé dans les liens.' : undefined}>
            <input id="slug" className="input" value={v.slug} readOnly={!!id} onChange={(e) => set('slug', e.target.value)} />
          </Field>
          <Field label="Description courte" htmlFor="excerpt" full error={errors.excerpt} hint="Affichée dans la liste des actualités (240 caractères max).">
            <input id="excerpt" className="input" value={v.excerpt} onChange={(e) => set('excerpt', e.target.value)} />
          </Field>
          <Field label="Texte" htmlFor="body" full error={errors.body} hint="Paragraphes séparés par une ligne vide.">
            <textarea id="body" className="textarea" style={{ minHeight: 220 }} value={v.body} onChange={(e) => set('body', e.target.value)} />
          </Field>
          <ImageField bucket="news" folder="covers" label="Image" value={v.cover_path} onChange={(k) => set('cover_path', k)} />
        </div>
        <div className="form-actions">
          {state !== 'draft' && (
            <Button variant="danger" onClick={() => setConfirmUnpublish(true)}>
              Dépublier
            </Button>
          )}
          <span className="grow" />
          <Button onClick={() => validate() && save.mutate(v)} loading={save.isPending}>
            {state === 'draft' ? 'Enregistrer le brouillon' : 'Enregistrer'}
          </Button>
          {state !== 'published' && (
            <Button variant="primary" onClick={() => validate() && publish.mutate(null)} loading={publish.isPending}>
              Publier maintenant
            </Button>
          )}
        </div>
      </section>

      {state !== 'published' && (
        <section className="card">
          <h2 style={{ marginBottom: 10 }}>Programmer la publication</h2>
          <div className="row">
            <input className="input" type="date" aria-label="Date de publication" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} style={{ width: 180 }} />
            <input className="input" type="time" aria-label="Heure de publication" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} style={{ width: 130 }} />
            <Button
              disabled={!scheduleAt}
              loading={publish.isPending}
              onClick={() => {
                if (!scheduleAt) return;
                if (scheduleAt.getTime() <= Date.now()) return setErrors({ schedule: 'Choisissez une date et une heure à venir.' });
                if (validate()) publish.mutate(scheduleAt);
              }}>
              Programmer
            </Button>
            <span className="faint small">Heure du club. L’article apparaît automatiquement à cette heure.</span>
          </div>
          {errors.schedule && (
            <p className="error" role="alert" style={{ color: 'var(--danger)', marginTop: 8 }}>
              {errors.schedule}
            </p>
          )}
          {state === 'scheduled' && <Notice tone="warning">Publication programmée le {formatInstant(row?.published_at)}.</Notice>}
        </section>
      )}

      {id && isAdmin && <AuditTrail entityId={id} />}
      <ConfirmDialog
        open={confirmUnpublish}
        title="Dépublier cet article ?"
        confirmLabel="Dépublier"
        busy={unpublish.isPending}
        onClose={() => setConfirmUnpublish(false)}
        onConfirm={() => unpublish.mutate(undefined)}>
        <p className="muted">L’article disparaît de l’application au prochain rafraîchissement. Il redevient un brouillon.</p>
      </ConfirmDialog>
    </>
  );
}

function NewsItemPageContent() {
  const { id: param } = useParams<{ id: string }>();
  const id = param === 'new' ? null : param;
  const item = useNewsItem(id);
  return (
    <>
      {!id ? (
        <NewsEditor id={null} initial={{ slug: '', category: 'announcement', title: '', excerpt: '', body: '', cover_path: null }} />
      ) : item.isError ? (
        <LoadError onRetry={() => item.refetch()} />
      ) : !item.data ? (
        <Skeleton height={420} />
      ) : (
        <NewsEditor key={item.dataUpdatedAt} id={id} initial={{ ...item.data }} row={item.data} />
      )}
    </>
  );
}

/** Gate first: the page's queries only run for roles allowed to see it. */
export default function NewsItemPage() {
  return (
    <RequireCapability capability="news">
      <NewsItemPageContent />
    </RequireCapability>
  );
}
