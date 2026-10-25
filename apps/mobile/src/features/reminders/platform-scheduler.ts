import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { colors } from '@/theme';

import type { NotificationScheduler, PermissionState } from './types';

/**
 * iOS / Android implementation (expo-notifications). The only module that
 * touches native notification APIs. Web uses ./platform-scheduler.web.ts.
 */

/** Single, simple Android channel for every class reminder. */
export const CLASS_REMINDER_CHANNEL_ID = 'class-reminders';

// Show reminders even when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let channelReady: Promise<unknown> | null = null;

/** Android requires the channel to exist before asking permission (13+) and scheduling. */
function ensureChannel(): Promise<unknown> {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelReady ??= Notifications.setNotificationChannelAsync(CLASS_REMINDER_CHANNEL_ID, {
    name: 'Cours & rappels',
    description: 'Rappels « Me le rappeler » avant vos cours.',
    importance: AndroidImportance.HIGH,
    lightColor: colors.brand,
    vibrationPattern: [0, 200, 120, 200],
    sound: 'default',
  });
  return channelReady;
}

function toState(p: Notifications.NotificationPermissionsStatus): PermissionState {
  const iosStatus = p.ios?.status;
  if (
    p.granted ||
    iosStatus === IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === IosAuthorizationStatus.EPHEMERAL
  ) {
    return 'granted';
  }
  // Never prompt again once the OS says it won't show the dialog.
  if (p.status === 'denied' || !p.canAskAgain) return 'denied';
  return 'undetermined';
}

export function createPlatformScheduler(): NotificationScheduler {
  return {
    kind: 'native',

    async getPermission() {
      return toState(await Notifications.getPermissionsAsync());
    },

    async requestPermission() {
      await ensureChannel();
      const current = toState(await Notifications.getPermissionsAsync());
      if (current !== 'undetermined') return current;
      return toState(
        await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowSound: true, allowBadge: false },
        }),
      );
    },

    async schedule({ content, triggerAt }) {
      await ensureChannel();
      return Notifications.scheduleNotificationAsync({
        content: { title: content.title, body: content.body, data: content.data, sound: 'default' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerAt,
          channelId: CLASS_REMINDER_CHANNEL_ID,
          // setExactAndAllowWhileIdle; no exact-alarm permission requested (see docs/DEV_BUILD.md).
          delivery: 'bestEffort',
        },
      });
    },

    async cancel(id) {
      await Notifications.cancelScheduledNotificationAsync(id);
    },

    async listScheduled() {
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      return pending.map((n) => ({ id: n.identifier, data: n.content.data }));
    },

    async openSettings() {
      await Linking.openSettings();
    },
  };
}
