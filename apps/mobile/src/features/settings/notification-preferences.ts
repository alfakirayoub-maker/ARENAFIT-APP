import { createPersistedStore } from '@/lib/persisted-store';

export type NotificationPreferences = {
  classReminders: boolean;
  scheduleChanges: boolean;
  clubNews: boolean;
  events: boolean;
};

/**
 * Kept on the device for now (no account required). Synced to
 * `notification_preferences` for signed-in users once push lands (Sprint 4).
 */
const store = createPersistedStore<NotificationPreferences>('notification-preferences', {
  classReminders: true,
  scheduleChanges: true,
  clubNews: true,
  events: true,
});

export function useNotificationPreferences() {
  const prefs = store.useStore();
  return {
    prefs,
    set: (key: keyof NotificationPreferences, value: boolean) => store.set((p) => ({ ...p, [key]: value })),
  };
}
