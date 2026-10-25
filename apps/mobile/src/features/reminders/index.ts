import AsyncStorage from '@react-native-async-storage/async-storage';

import { repository } from '@/data/source';
import i18n from '@/i18n';
import { notificationPreferencesStore } from '@/features/settings/notification-preferences';

import { createPlatformScheduler } from './platform-scheduler';
import { ReminderService, type FetchSessions } from './service';
import type { ReminderPersistence, ReminderRecord, Translate } from './types';

/**
 * Composition root for class reminders: the platform scheduler (Expo on
 * iOS/Android, simulated on web), on-device persistence and the app's
 * translations. Screens use the hooks in ./hooks.ts, never this module's
 * internals or expo-notifications directly.
 */

const STORAGE_KEY = 'arenafit:class-reminders.v2';

function isRecord(value: unknown): value is ReminderRecord {
  const r = value as Partial<ReminderRecord> | null;
  return (
    !!r &&
    typeof r.sessionId === 'string' &&
    typeof r.date === 'string' &&
    typeof r.startTime === 'string' &&
    typeof r.triggerAt === 'string' &&
    typeof r.offsetMinutes === 'number'
  );
}

const persistence: ReminderPersistence = {
  async load() {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  },
  async save(records) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  },
};

const translate: Translate = (key, params) => i18n.t(key as never, params as never) as unknown as string;

export const reminderService = new ReminderService({
  scheduler: createPlatformScheduler(),
  persistence,
  translate,
  notificationsEnabled: () => notificationPreferencesStore.get().classReminders,
});

/** Current planning for the given sessions, keyed by id (missing = deleted/unpublished). */
export const fetchSessionsForReminders: FetchSessions = async (ids) => {
  const sessions = await repository.getSessionsByIds(ids);
  return new Map(sessions.map((s) => [s.id, s]));
};
