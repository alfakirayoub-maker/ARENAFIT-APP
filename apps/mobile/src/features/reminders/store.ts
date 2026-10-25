import { createPersistedStore } from '@/lib/persisted-store';

export const reminderOffsets = [15, 30, 60, 120] as const;
export type ReminderOffset = (typeof reminderOffsets)[number];

/**
 * "Me le rappeler" — a reminder, never a reservation.
 *
 * Sprint 2 stores the choice on the device. Sprint 4 schedules the local
 * notification (expo-notifications) from these entries and re-schedules when a
 * session changes.
 */
const store = createPersistedStore<Record<string, ReminderOffset>>('class-reminders', {});

export function useReminders() {
  const reminders = store.useStore();
  return {
    offsetFor: (sessionId: string): ReminderOffset | undefined => reminders[sessionId],
    set: (sessionId: string, offset: ReminderOffset) => store.set((prev) => ({ ...prev, [sessionId]: offset })),
    remove: (sessionId: string) =>
      store.set((prev) => {
        const { [sessionId]: _removed, ...rest } = prev;
        return rest;
      }),
  };
}
