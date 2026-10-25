/// <reference types="node" />
/**
 * Class reminders: trigger maths, availability, the ReminderService (with a
 * fake OS scheduler), reconciliation and notification routing.
 * Run under several device timezones by `npm run test:timezones`.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import fr from '../src/i18n/locales/fr.ts';
import {
  availableOffsets,
  buildNotificationContent,
  planReconciliation,
  reminderTriggerAt,
  routeForNotificationData,
} from '../src/features/reminders/logic.ts';
import { ReminderService } from '../src/features/reminders/service.ts';
import type {
  NotificationContent,
  NotificationScheduler,
  PermissionState,
  ReminderPersistence,
  ReminderRecord,
} from '../src/features/reminders/types.ts';
import type { ClassSession } from '../src/types/domain.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** i18next-style lookup on the real French dictionary. */
const t = (key: string, params: Record<string, string | number> = {}) => {
  const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], fr);
  assert.equal(typeof value, 'string', `missing translation: ${key}`);
  return (value as string).replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name]));
};

function session(overrides: Partial<ClassSession> = {}): ClassSession {
  return {
    id: 'session-rpm',
    date: '2026-11-02',
    startTime: '18:00',
    endTime: '19:00',
    activity: { id: 'activity-rpm', slug: 'rpm', name: 'RPM', category: 'cycling', imageUrl: null },
    coach: { id: 'coach-anas-d', slug: 'anas-d', displayName: 'ANAS D', photoUrl: null },
    room: null,
    level: 'all_levels',
    description: null,
    isCancelled: false,
    ...overrides,
  };
}

class FakeScheduler implements NotificationScheduler {
  readonly kind = 'native' as const;
  permission: PermissionState = 'granted';
  promptResult: PermissionState = 'granted';
  prompts = 0;
  pending = new Map<string, { content: NotificationContent; triggerAt: Date }>();
  private nextId = 1;

  async getPermission() {
    return this.permission;
  }
  async requestPermission() {
    this.prompts += 1;
    if (this.permission === 'undetermined') this.permission = this.promptResult;
    return this.permission;
  }
  async schedule(request: { content: NotificationContent; triggerAt: Date }) {
    const id = `n${this.nextId++}`;
    this.pending.set(id, request);
    return id;
  }
  async cancel(id: string) {
    this.pending.delete(id);
  }
  async listScheduled() {
    return [...this.pending].map(([id, r]) => ({ id, data: r.content.data }));
  }
  async openSettings() {}
}

class MemoryPersistence implements ReminderPersistence {
  saved: ReminderRecord[] = [];
  async load() {
    return this.saved;
  }
  async save(records: ReminderRecord[]) {
    this.saved = records;
  }
}

let clock = new Date('2026-11-02T12:00:00Z');
let enabled = true;
let scheduler: FakeScheduler;
let persistence: MemoryPersistence;
let service: ReminderService;

beforeEach(() => {
  clock = new Date('2026-11-02T12:00:00Z');
  enabled = true;
  scheduler = new FakeScheduler();
  persistence = new MemoryPersistence();
  service = new ReminderService({
    scheduler,
    persistence,
    translate: t,
    notificationsEnabled: () => enabled,
    now: () => clock,
  });
});

const fetchFrom = (...sessions: ClassSession[]) => async () => new Map(sessions.map((s) => [s.id, s]));

// ---------------------------------------------------------------------------
// Trigger maths
// ---------------------------------------------------------------------------

describe('reminder trigger instants', () => {
  it('subtracts 15/30/60/120 minutes from the class start (club time = UTC after 2026-09-20)', () => {
    assert.equal(reminderTriggerAt('2026-11-02', '18:00', 15).toISOString(), '2026-11-02T17:45:00.000Z');
    assert.equal(reminderTriggerAt('2026-11-02', '18:00', 30).toISOString(), '2026-11-02T17:30:00.000Z');
    assert.equal(reminderTriggerAt('2026-11-02', '18:00', 60).toISOString(), '2026-11-02T17:00:00.000Z');
    assert.equal(reminderTriggerAt('2026-11-02', '18:00', 120).toISOString(), '2026-11-02T16:00:00.000Z');
  });

  it('uses UTC+1 for classes before the 2026-09-20 switch', () => {
    assert.equal(reminderTriggerAt('2026-09-19', '18:00', 30).toISOString(), '2026-09-19T16:30:00.000Z');
  });

  it('subtracts real minutes across the switch night (not wall-clock arithmetic)', () => {
    // 02:00 on the switch day is 02:00 UTC; two hours earlier is 00:00 UTC (= 01:00 at UTC+1).
    assert.equal(reminderTriggerAt('2026-09-20', '02:00', 120).toISOString(), '2026-09-20T00:00:00.000Z');
    // 07:00 on the switch day: one real hour earlier.
    assert.equal(reminderTriggerAt('2026-09-20', '07:00', 60).toISOString(), '2026-09-20T06:00:00.000Z');
  });
});

describe('available offsets', () => {
  it('offers all offsets well before the class', () => {
    assert.deepEqual(availableOffsets(session(), new Date('2026-11-02T12:00:00Z')), [15, 30, 60, 120]);
  });

  it('hides offsets whose reminder time has passed (class in 20 min → only 15 min)', () => {
    assert.deepEqual(availableOffsets(session(), new Date('2026-11-02T17:40:00Z')), [15]);
  });

  it('offers nothing for a class in progress, finished or cancelled', () => {
    assert.deepEqual(availableOffsets(session(), new Date('2026-11-02T18:10:00Z')), []);
    assert.deepEqual(availableOffsets(session(), new Date('2026-11-02T20:00:00Z')), []);
    assert.deepEqual(availableOffsets(session({ isCancelled: true }), new Date('2026-11-02T12:00:00Z')), []);
  });
});

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

describe('ReminderService', () => {
  it('schedules one native notification with French copy and routing data', async () => {
    const result = await service.scheduleClassReminder(session(), 30);
    assert.equal(result.status, 'scheduled');
    assert.equal(scheduler.pending.size, 1);
    const [request] = scheduler.pending.values();
    assert.equal(request.triggerAt.toISOString(), '2026-11-02T17:30:00.000Z');
    assert.equal(request.content.title, 'RPM dans 30 min');
    assert.equal(request.content.body, 'Votre séance avec ANAS D commence à 18:00 chez Arena Fit.');
    assert.deepEqual(request.content.data, { type: 'class-reminder', sessionId: 'session-rpm' });
    assert.doesNotMatch(`${request.content.title} ${request.content.body}`, /r[ée]servation/i);
    assert.equal(persistence.saved.length, 1);
    assert.equal(persistence.saved[0].notificationId, [...scheduler.pending.keys()][0]);
  });

  it('never creates a duplicate for the same session, even on concurrent taps', async () => {
    await Promise.all([service.scheduleClassReminder(session(), 30), service.scheduleClassReminder(session(), 30)]);
    await service.scheduleClassReminder(session(), 30);
    assert.equal(scheduler.pending.size, 1);
    assert.equal(service.getSnapshot().length, 1);
  });

  it('changing the offset updates the same reminder', async () => {
    await service.scheduleClassReminder(session(), 30);
    const created = service.getSnapshot()[0];
    await service.updateClassReminder(session(), 60);
    const updated = service.getSnapshot()[0];
    assert.equal(service.getSnapshot().length, 1);
    assert.equal(updated.offsetMinutes, 60);
    assert.equal(updated.createdAt, created.createdAt);
    assert.notEqual(updated.notificationId, created.notificationId);
    assert.equal(scheduler.pending.size, 1);
    assert.equal([...scheduler.pending.values()][0].triggerAt.toISOString(), '2026-11-02T17:00:00.000Z');
  });

  it('deleting a reminder cancels the OS notification', async () => {
    await service.scheduleClassReminder(session(), 15);
    await service.cancelClassReminder('session-rpm');
    assert.equal(scheduler.pending.size, 0);
    assert.equal(service.getSnapshot().length, 0);
    assert.equal(persistence.saved.length, 0);
  });

  it('refuses a reminder whose time already passed, and in-progress classes', async () => {
    clock = new Date('2026-11-02T17:40:00Z');
    assert.equal((await service.scheduleClassReminder(session(), 30)).status, 'unavailable');
    clock = new Date('2026-11-02T18:05:00Z');
    assert.equal((await service.scheduleClassReminder(session(), 15)).status, 'unavailable');
    assert.equal(scheduler.pending.size, 0);
  });

  it('asks the UI to explain before the first permission prompt, and never prompts by itself', async () => {
    scheduler.permission = 'undetermined';
    assert.equal((await service.scheduleClassReminder(session(), 30)).status, 'permission-required');
    assert.equal(scheduler.prompts, 0);
    assert.equal(service.getSnapshot().length, 0);
    assert.equal(await service.requestPermission(), 'granted');
    assert.equal((await service.scheduleClassReminder(session(), 30)).status, 'scheduled');
  });

  it('does not save anything or re-prompt when permission is denied', async () => {
    scheduler.permission = 'denied';
    assert.equal((await service.scheduleClassReminder(session(), 30)).status, 'permission-denied');
    assert.equal(service.getSnapshot().length, 0);
    assert.equal(await service.requestPermission(), 'denied');
  });

  it('keeps reminders but no OS notifications while "Cours & rappels" is off, and restores them', async () => {
    await service.scheduleClassReminder(session(), 30);
    enabled = false;
    await service.applyNotificationsEnabled(false);
    assert.equal(scheduler.pending.size, 0);
    assert.equal(service.getSnapshot()[0].notificationId, null);
    enabled = true;
    await service.applyNotificationsEnabled(true);
    assert.equal(scheduler.pending.size, 1);
  });
});

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

describe('reconciliation', () => {
  it('re-schedules a moved class (18:00 → 19:00) without leaving the old notification', async () => {
    await service.scheduleClassReminder(session(), 30);
    const report = await service.reconcileReminders(fetchFrom(session({ startTime: '19:00', endTime: '20:00' })));
    assert.equal(report.changes.length, 1);
    assert.equal(report.changes[0].type, 'rescheduled');
    assert.equal(scheduler.pending.size, 1);
    assert.equal([...scheduler.pending.values()][0].triggerAt.toISOString(), '2026-11-02T18:30:00.000Z');
    assert.equal([...scheduler.pending.values()][0].content.body, 'Votre séance avec ANAS D commence à 19:00 chez Arena Fit.');
    assert.equal(service.getSnapshot()[0].startTime, '19:00');
  });

  it('removes reminders of cancelled classes', async () => {
    await service.scheduleClassReminder(session(), 30);
    const report = await service.reconcileReminders(fetchFrom(session({ isCancelled: true })));
    assert.deepEqual(report.changes.map((c) => c.type === 'removed' && c.reason), ['cancelled']);
    assert.equal(scheduler.pending.size, 0);
    assert.equal(service.getSnapshot().length, 0);
  });

  it('removes reminders of deleted or unpublished classes', async () => {
    await service.scheduleClassReminder(session(), 30);
    const report = await service.reconcileReminders(fetchFrom());
    assert.deepEqual(report.changes.map((c) => c.type === 'removed' && c.reason), ['deleted']);
    assert.equal(scheduler.pending.size, 0);
  });

  it('removes reminders of classes that already started or finished', async () => {
    await service.scheduleClassReminder(session(), 30);
    clock = new Date('2026-11-02T19:30:00Z');
    const report = await service.reconcileReminders(fetchFrom(session()));
    assert.deepEqual(report.changes.map((c) => c.type === 'removed' && c.reason), ['started']);
    assert.equal(service.getSnapshot().length, 0);
  });

  it('removes a reminder when the class moved so early that its time has passed', async () => {
    await service.scheduleClassReminder(session(), 120);
    clock = new Date('2026-11-02T16:30:00Z');
    const report = await service.reconcileReminders(fetchFrom(session({ startTime: '17:00', endTime: '18:00' })));
    assert.deepEqual(report.changes.map((c) => c.type === 'removed' && c.reason), ['too-late']);
  });

  it('keeps unchanged reminders and their OS notification as-is', async () => {
    await service.scheduleClassReminder(session(), 30);
    const before = service.getSnapshot()[0].notificationId;
    const report = await service.reconcileReminders(fetchFrom(session()));
    assert.equal(report.changes.length, 0);
    assert.equal(service.getSnapshot()[0].notificationId, before);
    assert.equal(scheduler.pending.size, 1);
  });

  it('keeps everything when the planning cannot be loaded (offline)', async () => {
    await service.scheduleClassReminder(session(), 30);
    const report = await service.reconcileReminders(async () => {
      throw new Error('offline');
    });
    assert.equal(report.planningAvailable, false);
    assert.equal(report.changes.length, 0);
    assert.equal(scheduler.pending.size, 1);
  });

  it('restores a notification the OS lost and cancels orphaned ones', async () => {
    await service.scheduleClassReminder(session(), 30);
    scheduler.pending.clear(); // e.g. OS cleared pending notifications
    await scheduler.schedule({
      content: { title: 'x', body: 'x', data: { type: 'class-reminder', sessionId: 'gone' } },
      triggerAt: new Date('2026-11-03T10:00:00Z'),
    });
    await service.reconcileReminders(fetchFrom(session()));
    const pending = [...scheduler.pending.values()];
    assert.equal(pending.length, 1);
    assert.equal(pending[0].content.data.sessionId, 'session-rpm');
  });

  it('does not re-notify for a reminder that already fired', () => {
    const record: ReminderRecord = {
      sessionId: 'session-rpm',
      activityId: 'activity-rpm',
      activitySlug: 'rpm',
      title: 'RPM',
      coachName: 'ANAS D',
      date: '2026-11-02',
      startTime: '18:00',
      offsetMinutes: 30,
      triggerAt: '2026-11-02T17:30:00.000Z',
      notificationId: 'n1',
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
    };
    const [action] = planReconciliation([record], new Map([[record.sessionId, session()]]), new Date('2026-11-02T17:45:00Z'), new Set());
    assert.equal(action.type, 'keep');
  });
});

// ---------------------------------------------------------------------------
// Notification content & tap routing
// ---------------------------------------------------------------------------

describe('notification content and routing', () => {
  it('formats hours for 60/120 min and handles a class without coach', () => {
    const base = {
      sessionId: 's1',
      activityId: 'a',
      activitySlug: 'body-pump',
      title: 'Body Pump',
      coachName: null,
      date: '2026-11-02',
      startTime: '19:15',
      triggerAt: '2026-11-02T17:15:00.000Z',
      notificationId: null,
      createdAt: '',
      updatedAt: '',
    };
    const content = buildNotificationContent({ ...base, offsetMinutes: 120 }, t);
    assert.equal(content.title, 'Body Pump dans 2 h');
    assert.equal(content.body, 'Votre séance commence à 19:15 chez Arena Fit.');
    assert.equal(buildNotificationContent({ ...base, offsetMinutes: 60 }, t).title, 'Body Pump dans 1 h');
  });

  it('routes a class reminder tap to that exact class', () => {
    assert.deepEqual(routeForNotificationData({ type: 'class-reminder', sessionId: '2b1c-uuid_like' }), {
      pathname: '/classes/[id]',
      params: { id: '2b1c-uuid_like', from: 'reminder' },
    });
  });

  it('ignores unknown, malformed or hostile payloads', () => {
    for (const data of [
      null,
      'class-reminder',
      { type: 'news', slug: 'x' },
      { type: 'class-reminder' },
      { type: 'class-reminder', sessionId: '../../admin' },
      { type: 'class-reminder', sessionId: 'https://evil.example' },
      { url: 'https://evil.example' },
    ]) {
      assert.equal(routeForNotificationData(data), null, JSON.stringify(data));
    }
  });
});
