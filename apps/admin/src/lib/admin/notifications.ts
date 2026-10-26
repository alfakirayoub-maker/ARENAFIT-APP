import { notificationSchema, type NotificationValues } from '../validation';
import { run, type Db } from './core';

export type NotificationRow = NotificationValues & {
  id: string;
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  created_at: string;
  updated_at: string;
};

const SELECT = 'id, category, title, body, deep_link, audience, audience_activity_ids, status, created_at, updated_at';

/**
 * Drafts only: remote push delivery is not wired yet (device token
 * registration, final auth, Expo/FCM/APNs). The database refuses any status
 * other than 'draft' from the dashboard.
 */
export const PUSH_DELIVERY_AVAILABLE = false;

export const listNotifications = (db: Db) =>
  run<NotificationRow[]>(db.from('notifications').select(SELECT).order('updated_at', { ascending: false }).returns<NotificationRow[]>());

export async function saveNotificationDraft(db: Db, id: string | null, input: unknown): Promise<string> {
  const values = notificationSchema.parse(input);
  const saved = id
    ? await run<{ id: string }>(db.from('notifications').update(values).eq('id', id).select('id').single())
    : await run<{ id: string }>(db.from('notifications').insert(values).select('id').single());
  return saved.id;
}

export async function deleteNotificationDraft(db: Db, id: string): Promise<void> {
  await run(db.from('notifications').delete().eq('id', id).select('id').single());
}
