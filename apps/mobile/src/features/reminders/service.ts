/**
 * ReminderService — platform-independent orchestration of class reminders.
 *
 *   UI → hooks (./hooks.ts) → ReminderService → NotificationScheduler (Expo | simulated)
 *
 * Owns the persisted reminder records (one per session), keeps them in sync
 * with the OS notifications and with the current planning. No React Native
 * imports: unit-tested under Node with a fake scheduler.
 */
import type { ClassSession } from '@/types/domain';

import { availableOffsets, buildNotificationContent, buildRecord, planReconciliation, type ReconcileAction } from './logic';
import {
  type NotificationScheduler,
  type PermissionState,
  type ReminderOffset,
  type ReminderPersistence,
  type ReminderRecord,
  type Translate,
} from './types';

export type ScheduleResult =
  /** Reminder saved and a real notification scheduled. */
  | { status: 'scheduled'; record: ReminderRecord }
  /** Reminder saved without an OS notification (web preview, or class reminders turned off). */
  | { status: 'saved'; record: ReminderRecord; reason: 'simulated' | 'reminders-off' }
  /** Permission never asked: explain, request, then call again. Nothing saved. */
  | { status: 'permission-required' }
  /** Permission refused: only system settings can change it. Nothing saved. */
  | { status: 'permission-denied' }
  /** The class started, was cancelled, or this offset's time has passed. Nothing saved. */
  | { status: 'unavailable' };

export type ReconcileChange =
  | { type: 'rescheduled'; record: ReminderRecord; previousDate: string; previousStartTime: string }
  | { type: 'removed'; record: ReminderRecord; reason: 'cancelled' | 'deleted' | 'started' | 'too-late' };

export type ReconcileReport = { changes: ReconcileChange[]; planningAvailable: boolean };

/** Loads the current version of the given sessions; ids missing from the map no longer exist. */
export type FetchSessions = (ids: string[]) => Promise<Map<string, ClassSession>>;

type Deps = {
  scheduler: NotificationScheduler;
  persistence: ReminderPersistence;
  translate: Translate;
  /** Whether "Cours & rappels" notifications are enabled (Profil › Notifications). */
  notificationsEnabled: () => boolean;
  now?: () => Date;
};

export class ReminderService {
  private readonly deps: Deps;
  private records: ReminderRecord[] = [];
  private readonly listeners = new Set<() => void>();
  private readonly ready: Promise<void>;
  /** Serialises every mutation so double taps can never create duplicate notifications. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(deps: Deps) {
    this.deps = deps;
    this.ready = deps.persistence
      .load()
      .then((records) => {
        // One record per session, even if storage was corrupted.
        const bySession = new Map(records.map((r) => [r.sessionId, r]));
        this.records = [...bySession.values()];
        this.emit();
      })
      .catch(() => {});
  }

  // Reactive access -----------------------------------------------------------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): readonly ReminderRecord[] => this.records;

  get kind() {
    return this.deps.scheduler.kind;
  }

  async getScheduledReminders(): Promise<readonly ReminderRecord[]> {
    await this.ready;
    return this.records;
  }

  // Permission ----------------------------------------------------------------

  getPermission(): Promise<PermissionState> {
    return this.deps.scheduler.getPermission();
  }

  requestPermission(): Promise<PermissionState> {
    return this.deps.scheduler.requestPermission();
  }

  openSettings(): Promise<void> {
    return this.deps.scheduler.openSettings();
  }

  // Mutations -----------------------------------------------------------------

  /**
   * Creates or replaces the reminder for a session (never a second one).
   * Does not prompt for permission: returns `permission-required` so the UI can
   * explain first, then call `requestPermission()` and retry.
   */
  scheduleClassReminder(session: ClassSession, offset: ReminderOffset): Promise<ScheduleResult> {
    return this.serial(async () => {
      const now = this.now();
      if (!availableOffsets(session, now).includes(offset)) return { status: 'unavailable' };

      const existing = this.find(session.id);
      const record = buildRecord(session, offset, now, existing);

      if (!this.deps.notificationsEnabled()) {
        await this.cancelNative(existing);
        const saved = await this.save({ ...record, notificationId: null });
        return { status: 'saved', reason: 'reminders-off', record: saved };
      }

      const permission = await this.deps.scheduler.getPermission();
      if (permission === 'undetermined') return { status: 'permission-required' };
      if (permission === 'denied') return { status: 'permission-denied' };

      await this.cancelNative(existing);
      if (permission === 'unavailable' || this.deps.scheduler.kind === 'simulated') {
        const id = permission === 'granted' ? await this.scheduleNative(record) : null;
        const saved = await this.save({ ...record, notificationId: id });
        return { status: 'saved', reason: 'simulated', record: saved };
      }
      const saved = await this.save({ ...record, notificationId: await this.scheduleNative(record) });
      return { status: 'scheduled', record: saved };
    });
  }

  /** Changes the offset of an existing reminder (same record, re-scheduled). */
  updateClassReminder(session: ClassSession, offset: ReminderOffset): Promise<ScheduleResult> {
    return this.scheduleClassReminder(session, offset);
  }

  cancelClassReminder(sessionId: string): Promise<void> {
    return this.serial(async () => {
      const existing = this.find(sessionId);
      if (!existing) return;
      await this.cancelNative(existing);
      await this.persist(this.records.filter((r) => r.sessionId !== sessionId));
    });
  }

  /**
   * Turning "Cours & rappels" off cancels every OS notification but keeps the
   * reminders; turning it back on re-schedules the ones still in the future.
   */
  applyNotificationsEnabled(enabled: boolean): Promise<void> {
    return this.serial(async () => {
      await this.ready;
      const next: ReminderRecord[] = [];
      for (const record of this.records) {
        if (!enabled) {
          await this.cancelNative(record);
          next.push({ ...record, notificationId: null });
        } else if (record.notificationId === null && Date.parse(record.triggerAt) > this.now().getTime()) {
          const permission = await this.deps.scheduler.getPermission();
          next.push(permission === 'granted' ? { ...record, notificationId: await this.scheduleNative(record) } : record);
        } else {
          next.push(record);
        }
      }
      await this.persist(next);
    });
  }

  /**
   * Brings every saved reminder in line with the current planning:
   * moved → re-scheduled, cancelled/deleted/started → removed, unchanged →
   * kept. If the planning can't be loaded, nothing is cancelled.
   * Also cancels orphaned OS class reminders and restores ones the OS lost.
   */
  reconcileReminders(fetchSessions: FetchSessions): Promise<ReconcileReport> {
    return this.serial(async () => {
      await this.ready;
      const now = this.now();
      const ids = this.records.map((r) => r.sessionId);

      let sessions: Map<string, ClassSession> | null = new Map();
      if (ids.length > 0) {
        try {
          sessions = await fetchSessions(ids);
        } catch {
          sessions = null;
        }
      }

      const enabled = this.deps.notificationsEnabled();
      const permission = await this.deps.scheduler.getPermission();
      const canSchedule = enabled && permission === 'granted';
      const native = await this.deps.scheduler.listScheduled().catch(() => null);
      const nativeIds = native ? new Set(native.map((n) => n.id)) : null;

      const changes: ReconcileChange[] = [];
      const next: ReminderRecord[] = [];
      for (const action of planReconciliation(this.records, sessions, now, nativeIds)) {
        const result = await this.apply(action, now, canSchedule);
        if (result.record) next.push(result.record);
        if (result.change) changes.push(result.change);
      }

      // OS class reminders no record points to (e.g. left over after a crash).
      const kept = new Set(next.map((r) => r.notificationId).filter(Boolean));
      for (const n of native ?? []) {
        const data = n.data as { type?: string } | null;
        if (data?.type === 'class-reminder' && !kept.has(n.id)) await this.deps.scheduler.cancel(n.id).catch(() => {});
      }

      await this.persist(next);
      return { changes, planningAvailable: sessions !== null };
    });
  }

  // Internals -----------------------------------------------------------------

  private async apply(
    action: ReconcileAction,
    now: Date,
    canSchedule: boolean,
  ): Promise<{ record?: ReminderRecord; change?: ReconcileChange }> {
    switch (action.type) {
      case 'keep':
        return { record: action.record };
      case 'remove':
        await this.cancelNative(action.record);
        return { change: { type: 'removed', record: action.record, reason: action.reason } };
      case 'reschedule':
      case 'refresh': {
        await this.cancelNative(action.record);
        const updated = buildRecord(action.session, action.record.offsetMinutes, now, action.record);
        const notificationId = canSchedule ? await this.scheduleNative(updated) : null;
        const record = { ...updated, notificationId };
        return action.type === 'reschedule'
          ? {
              record,
              change: {
                type: 'rescheduled',
                record,
                previousDate: action.previousDate,
                previousStartTime: action.previousStartTime,
              },
            }
          : { record };
      }
    }
  }

  private now() {
    return this.deps.now?.() ?? new Date();
  }

  private find(sessionId: string) {
    return this.records.find((r) => r.sessionId === sessionId);
  }

  private scheduleNative(record: ReminderRecord): Promise<string> {
    return this.deps.scheduler.schedule({
      content: buildNotificationContent(record, this.deps.translate),
      triggerAt: new Date(record.triggerAt),
    });
  }

  private async cancelNative(record: ReminderRecord | undefined) {
    if (record?.notificationId) await this.deps.scheduler.cancel(record.notificationId).catch(() => {});
  }

  /** Upserts the session's single record. */
  private async save(record: ReminderRecord): Promise<ReminderRecord> {
    await this.persist([...this.records.filter((r) => r.sessionId !== record.sessionId), record]);
    return record;
  }

  private async persist(records: ReminderRecord[]) {
    this.records = records;
    this.emit();
    await this.deps.persistence.save(records).catch(() => {});
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      await this.ready;
      return task();
    });
    this.queue = run.catch(() => {});
    return run;
  }
}
