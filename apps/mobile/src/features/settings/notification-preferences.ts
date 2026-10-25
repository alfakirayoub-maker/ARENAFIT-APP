import { createPersistedStore } from '@/lib/persisted-store';

/**
 * Notification preferences, stored on the device (no account needed).
 *
 *  - classReminders: IMPLEMENTED — controls local "Me le rappeler" notifications.
 *  - news, offersEvents, scheduleChanges: FUTURE remote push categories. Saved
 *    now so the user's choice is respected once Arena Fit sends them; nothing
 *    is sent today. Synced to `notification_preferences` once device
 *    registration exists.
 */
export type NotificationPreferences = {
  classReminders: boolean;
  news: boolean;
  offersEvents: boolean;
  scheduleChanges: boolean;
};

export const notificationPreferencesStore = createPersistedStore<NotificationPreferences>('notification-preferences.v2', {
  classReminders: true,
  news: true,
  offersEvents: true,
  scheduleChanges: true,
});

export function useNotificationPreferences() {
  const prefs = notificationPreferencesStore.useStore();
  return {
    prefs,
    set: (key: keyof NotificationPreferences, value: boolean) =>
      notificationPreferencesStore.set((p) => ({ ...p, [key]: value })),
  };
}
