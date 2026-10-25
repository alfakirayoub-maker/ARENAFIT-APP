import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Platform } from 'react-native';

import { useToast } from '@/components/ui/Toast';
import { queryKeys } from '@/data/queries';
import { notificationPreferencesStore, useNotificationPreferences } from '@/features/settings/notification-preferences';
import { formatDayLong } from '@/lib/club-time';

import { fetchSessionsForReminders, reminderService } from './index';
import { onReconcileRequest } from './reconcile-requests';
import type { ReconcileChange } from './service';
import { subscribeSimulatedPermission } from './simulated-permission';
import type { PermissionState, ReminderRecord } from './types';

/** All saved reminders (reactive). */
export function useReminders(): readonly ReminderRecord[] {
  return useSyncExternalStore(reminderService.subscribe, reminderService.getSnapshot, reminderService.getSnapshot);
}

/** The reminder of one session, if any. */
export function useReminder(sessionId: string): ReminderRecord | undefined {
  return useReminders().find((r) => r.sessionId === sessionId);
}

/** OS notification permission, refreshed when the app returns to the foreground (e.g. from Settings). */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const refresh = useCallback(() => {
    void reminderService.getPermission().then(setPermission);
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    const unsubscribeSimulated = Platform.OS === 'web' ? subscribeSimulatedPermission(refresh) : undefined;
    return () => {
      sub.remove();
      unsubscribeSimulated?.();
    };
  }, [refresh]);

  return { permission, refresh };
}

/** "Cours & rappels" switch: also cancels / restores the OS notifications. */
export function useClassReminderPreference() {
  const { prefs, set } = useNotificationPreferences();
  const setEnabled = useCallback(
    (enabled: boolean) => {
      set('classReminders', enabled);
      void reminderService.applyNotificationsEnabled(enabled);
    },
    [set],
  );
  return [prefs.classReminders, setEnabled] as const;
}

// Reconciliation ----------------------------------------------------------------

const FOREGROUND_THROTTLE_MS = 30_000;

/**
 * Keeps saved reminders in line with the planning: on launch, when the app
 * returns to the foreground, and after a planning refresh. Tells the user when
 * a reminder was moved or removed because the class changed.
 * Rendered once, inside the toast and query providers.
 */
export function ReminderSync() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const lastRun = useRef(0);

  const describe = useCallback(
    (change: ReconcileChange): string | null => {
      const activity = change.record.title;
      const day = formatDayLong(change.record.date);
      if (change.type === 'rescheduled') return t('reminder.changed.rescheduled', { activity, time: change.record.startTime });
      switch (change.reason) {
        case 'cancelled':
          return t('reminder.changed.cancelled', { activity, day });
        case 'deleted':
          return t('reminder.changed.deleted', { activity, day });
        case 'too-late':
          return t('reminder.changed.tooLate', { activity });
        case 'started':
          return null; // expected end of life: no message
      }
    },
    [t],
  );

  const run = useCallback(async () => {
    lastRun.current = Date.now();
    await notificationPreferencesStore.hydrated;
    const report = await reminderService.reconcileReminders(fetchSessionsForReminders);
    const messages = report.changes.map(describe).filter((m): m is string => m !== null);
    if (messages.length > 0) {
      toast.show(messages.join('\n'), 'notifications-outline');
      // The planning on screen may predate the change.
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    }
  }, [describe, queryClient, toast]);

  useEffect(() => {
    void run();
    const unsubscribe = onReconcileRequest(() => void run());
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastRun.current > FOREGROUND_THROTTLE_MS) void run();
    });
    return () => {
      unsubscribe();
      sub.remove();
    };
  }, [run]);

  return null;
}
