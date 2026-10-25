/**
 * Pure reminder rules (no React Native, no OS APIs) — unit-tested in
 * tests/reminders.test.mts.
 */
import { clubInstant } from '@/lib/club-clock';
import type { ClassSession } from '@/types/domain';

import {
  reminderOffsets,
  type ClassReminderPayload,
  type NotificationContent,
  type ReminderOffset,
  type ReminderRecord,
  type Translate,
} from './types';

const MINUTE = 60_000;

/** Real instant a reminder fires: class start (via the club clock) minus the offset. */
export function reminderTriggerAt(date: string, startTime: string, offset: ReminderOffset): Date {
  return new Date(clubInstant(date, startTime).getTime() - offset * MINUTE);
}

/** Has the class started (or finished) at `now`? */
export function sessionHasStarted(session: Pick<ClassSession, 'date' | 'startTime'>, now: Date): boolean {
  return clubInstant(session.date, session.startTime).getTime() <= now.getTime();
}

/**
 * Offsets still meaningful at `now`: the class has not started, is not
 * cancelled, and the reminder would fire in the future.
 */
export function availableOffsets(session: ClassSession, now: Date): ReminderOffset[] {
  if (session.isCancelled || sessionHasStarted(session, now)) return [];
  return reminderOffsets.filter((o) => reminderTriggerAt(session.date, session.startTime, o).getTime() > now.getTime());
}

export function canSetReminder(session: ClassSession, now: Date): boolean {
  return availableOffsets(session, now).length > 0;
}

export function buildRecord(
  session: ClassSession,
  offset: ReminderOffset,
  now: Date,
  previous?: ReminderRecord,
): ReminderRecord {
  return {
    sessionId: session.id,
    activityId: session.activity.id,
    activitySlug: session.activity.slug,
    title: session.activity.name,
    coachName: session.coach?.displayName ?? null,
    date: session.date,
    startTime: session.startTime,
    offsetMinutes: offset,
    triggerAt: reminderTriggerAt(session.date, session.startTime, offset).toISOString(),
    notificationId: previous?.notificationId ?? null,
    createdAt: previous?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/** French-first, concise copy. Never mentions a reservation. */
export function buildNotificationContent(record: ReminderRecord, t: Translate): NotificationContent {
  const delay = t(`reminder.delay${record.offsetMinutes}`);
  return {
    title: t('reminder.notification.title', { activity: record.title, delay }),
    body: record.coachName
      ? t('reminder.notification.bodyWithCoach', { coach: record.coachName, time: record.startTime })
      : t('reminder.notification.body', { time: record.startTime }),
    data: { type: 'class-reminder', sessionId: record.sessionId },
  };
}

// Reconciliation ---------------------------------------------------------------

export type ReconcileAction =
  | { type: 'keep'; record: ReminderRecord }
  /** Session moved: cancel the old notification, schedule at the new time. */
  | { type: 'reschedule'; record: ReminderRecord; session: ClassSession; previousStartTime: string; previousDate: string }
  /** Same time, but snapshot (name, coach) changed or the OS lost the notification. */
  | { type: 'refresh'; record: ReminderRecord; session: ClassSession }
  | { type: 'remove'; record: ReminderRecord; reason: 'cancelled' | 'deleted' | 'started' | 'too-late' };

/**
 * Decides what to do with each saved reminder given the current planning.
 *
 * @param sessions  current sessions by id; a missing id means the session was
 *                  deleted or unpublished. Pass `null` when the planning could
 *                  not be loaded: every reminder is then kept untouched.
 * @param nativeIds ids pending in the OS, or null when unknown.
 */
export function planReconciliation(
  records: readonly ReminderRecord[],
  sessions: ReadonlyMap<string, ClassSession> | null,
  now: Date,
  nativeIds: ReadonlySet<string> | null,
): ReconcileAction[] {
  return records.map((record): ReconcileAction => {
    const session = sessions?.get(record.sessionId);

    if (!sessions) {
      // Offline: never cancel on uncertainty — only drop reminders whose class has started.
      return sessionHasStarted(record, now) ? { type: 'remove', record, reason: 'started' } : { type: 'keep', record };
    }
    if (!session) return { type: 'remove', record, reason: 'deleted' };
    if (session.isCancelled) return { type: 'remove', record, reason: 'cancelled' };
    if (sessionHasStarted(session, now)) return { type: 'remove', record, reason: 'started' };

    const moved = session.date !== record.date || session.startTime !== record.startTime;
    if (moved) {
      const newTrigger = reminderTriggerAt(session.date, session.startTime, record.offsetMinutes);
      if (newTrigger.getTime() <= now.getTime()) return { type: 'remove', record, reason: 'too-late' };
      return { type: 'reschedule', record, session, previousDate: record.date, previousStartTime: record.startTime };
    }

    // Already fired: leave it alone (re-scheduling would notify twice).
    if (Date.parse(record.triggerAt) <= now.getTime()) return { type: 'keep', record };

    const snapshotChanged =
      session.activity.name !== record.title || (session.coach?.displayName ?? null) !== record.coachName;
    const lostByOs = nativeIds !== null && record.notificationId !== null && !nativeIds.has(record.notificationId);
    return snapshotChanged || lostByOs ? { type: 'refresh', record, session } : { type: 'keep', record };
  });
}

// Notification tap routing ----------------------------------------------------

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Turns a notification payload into an in-app destination. Only known types
 * and well-formed ids are accepted — payloads never carry raw URLs to follow.
 */
export function routeForNotificationData(data: unknown): { pathname: '/classes/[id]'; params: { id: string; from: 'reminder' } } | null {
  if (!data || typeof data !== 'object') return null;
  const payload = data as Partial<ClassReminderPayload>;
  if (payload.type === 'class-reminder' && typeof payload.sessionId === 'string' && SAFE_ID.test(payload.sessionId)) {
    return { pathname: '/classes/[id]', params: { id: payload.sessionId, from: 'reminder' } };
  }
  return null;
}

export function isClassReminderPayload(data: unknown): data is ClassReminderPayload {
  return routeForNotificationData(data) !== null;
}
