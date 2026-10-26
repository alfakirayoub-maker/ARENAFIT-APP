'use client';

import { useState } from 'react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RequireCapability } from '@/components/Staff';
import { Badge, Button, Empty, Field, LoadError, Notice, PageHeader, Skeleton } from '@/components/ui';
import { keys, useAction, useActivities, useNotifications } from '@/lib/admin/hooks';
import { deleteNotificationDraft, PUSH_DELIVERY_AVAILABLE, saveNotificationDraft, type NotificationRow } from '@/lib/admin/notifications';
import { formatInstant } from '@/lib/dates';
import { NOTIFICATION_CATEGORY_LABEL } from '@/lib/labels';
import { fieldErrors, NOTIFICATION_CATEGORIES, notificationSchema } from '@/lib/validation';

type Draft = {
  category: (typeof NOTIFICATION_CATEGORIES)[number];
  title: string;
  body: string;
  deep_link: string;
  audience: 'all' | 'activity_preference';
  audience_activity_ids: string[];
};
const EMPTY: Draft = { category: 'club_news', title: '', body: '', deep_link: '', audience: 'all', audience_activity_ids: [] };

/**
 * Notification drafts. Sending is NOT active: remote push needs device token
 * registration, the final account/device identity and Expo/FCM/APNs
 * credentials. The database only accepts drafts from the dashboard.
 */
function NotificationsPageContent() {
  const list = useNotifications();
  const activities = useActivities();
  const [editing, setEditing] = useState<string | null>(null);
  const [v, setV] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<NotificationRow | null>(null);

  const save = useAction((db, d: Draft) => saveNotificationDraft(db, editing, d), {
    success: 'Brouillon enregistré',
    invalidate: [keys.notifications],
    onSuccess: () => {
      setEditing(null);
      setV(EMPTY);
    },
  });
  const remove = useAction((db, id: string) => deleteNotificationDraft(db, id), {
    success: 'Brouillon supprimé',
    invalidate: [keys.notifications],
    onSuccess: () => setToDelete(null),
  });

  const submit = () => {
    const parsed = notificationSchema.safeParse(v);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    save.mutate(v);
  };
  const edit = (n: NotificationRow) => {
    setEditing(n.id);
    setV({ ...n, deep_link: n.deep_link ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <PageHeader title="Notifications" subtitle="Rédaction et historique des notifications du club." />
      <Notice tone="warning">
        <span>
          <strong>Envoi pas encore actif.</strong> Les notifications push nécessitent l’enregistrement des appareils, la connexion
          définitive des membres et la configuration Expo / FCM / APNs. Vous pouvez préparer des brouillons ; aucun message n’est
          envoyé aux téléphones.
        </span>
      </Notice>

      <section className="card">
        <h2 style={{ marginBottom: 12 }}>{editing ? 'Modifier le brouillon' : 'Nouveau brouillon'}</h2>
        <div className="form">
          <Field label="Catégorie" htmlFor="ncat">
            <select id="ncat" className="select" value={v.category} onChange={(e) => setV((x) => ({ ...x, category: e.target.value as Draft['category'] }))}>
              {NOTIFICATION_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {NOTIFICATION_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Destinataires" htmlFor="naud">
            <select id="naud" className="select" value={v.audience} onChange={(e) => setV((x) => ({ ...x, audience: e.target.value as Draft['audience'] }))}>
              <option value="all">Tous les appareils éligibles</option>
              <option value="activity_preference">Intéressés par certaines activités</option>
              <option value="segments" disabled>
                Segments avancés (bientôt)
              </option>
            </select>
          </Field>
          {v.audience === 'activity_preference' && (
            <Field label="Activités" full error={errors.audience_activity_ids}>
              <div className="checks">
                {(activities.data ?? []).map((a) => (
                  <label key={a.id} className="check">
                    <input
                      type="checkbox"
                      checked={v.audience_activity_ids.includes(a.id)}
                      onChange={() =>
                        setV((x) => ({
                          ...x,
                          audience_activity_ids: x.audience_activity_ids.includes(a.id)
                            ? x.audience_activity_ids.filter((i) => i !== a.id)
                            : [...x.audience_activity_ids, a.id],
                        }))
                      }
                    />
                    {a.name}
                  </label>
                ))}
              </div>
            </Field>
          )}
          <Field label="Titre" htmlFor="ntitle" full error={errors.title} hint="80 caractères maximum.">
            <input id="ntitle" className="input" maxLength={80} value={v.title} onChange={(e) => setV((x) => ({ ...x, title: e.target.value }))} />
          </Field>
          <Field label="Message" htmlFor="nbody" full error={errors.body} hint="300 caractères maximum.">
            <textarea id="nbody" className="textarea" maxLength={300} style={{ minHeight: 90 }} value={v.body} onChange={(e) => setV((x) => ({ ...x, body: e.target.value }))} />
          </Field>
          <Field label="Ouvrir dans l’application (facultatif)" htmlFor="nlink" full error={errors.deep_link} hint="Lien interne, ex. arenafit://news/nouveau-planning ou arenafit://planning">
            <input id="nlink" className="input" value={v.deep_link} placeholder="arenafit://" onChange={(e) => setV((x) => ({ ...x, deep_link: e.target.value }))} />
          </Field>
        </div>
        <div className="form-actions">
          {editing && (
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setV(EMPTY);
                setErrors({});
              }}>
              Annuler la modification
            </Button>
          )}
          <span className="grow" />
          <Button onClick={submit} loading={save.isPending}>
            Enregistrer le brouillon
          </Button>
          <Button variant="primary" disabled={!PUSH_DELIVERY_AVAILABLE} title="Envoi pas encore actif">
            Envoyer (bientôt)
          </Button>
        </div>
      </section>

      {list.isError ? (
        <LoadError onRetry={() => list.refetch()} />
      ) : !list.data ? (
        <Skeleton height={160} />
      ) : list.data.length === 0 ? (
        <section className="card">
          <Empty>Aucun brouillon.</Empty>
        </section>
      ) : (
        <section className="card pad-0 table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Titre</th>
                <th>Catégorie</th>
                <th>Destinataires</th>
                <th>Statut</th>
                <th>Modifié</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((n) => (
                <tr key={n.id}>
                  <td style={{ fontWeight: 600 }}>{n.title}</td>
                  <td className="muted">{NOTIFICATION_CATEGORY_LABEL[n.category]}</td>
                  <td className="muted">{n.audience === 'all' ? 'Tous' : `${n.audience_activity_ids.length} activité(s)`}</td>
                  <td>{n.status === 'draft' ? <Badge>Brouillon</Badge> : <Badge tone="success">{n.status}</Badge>}</td>
                  <td className="muted small">{formatInstant(n.updated_at)}</td>
                  <td>
                    {n.status === 'draft' && (
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <Button size="sm" onClick={() => edit(n)}>
                          Modifier
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setToDelete(n)}>
                          Supprimer
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer ce brouillon ?"
        confirmLabel="Supprimer"
        busy={remove.isPending}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </>
  );
}

/** Gate first: the page's queries only run for roles allowed to see it. */
export default function NotificationsPage() {
  return (
    <RequireCapability capability="notifications">
      <NotificationsPageContent />
    </RequireCapability>
  );
}
