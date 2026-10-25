import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { routeForNotificationData } from '@/features/reminders/logic';

/**
 * Opens the right screen when a notification is tapped — cold start (app
 * launched by the tap), background and foreground. Only payloads accepted by
 * `routeForNotificationData` navigate; nothing else is followed.
 * Rendered once in the root layout, after the navigator. Web: ./NotificationRouter.web.tsx.
 */
export function NotificationRouter() {
  useEffect(() => {
    let lastHandled: string | null = null;

    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const key = response.notification.request.identifier;
      if (key === lastHandled) return;
      lastHandled = key;
      Notifications.clearLastNotificationResponse();

      const route = routeForNotificationData(response.notification.request.content.data);
      if (route) router.push(route);
    };

    // Cold start: the tap that launched the app.
    open(Notifications.getLastNotificationResponse());
    // App already running (foreground or background).
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);

  return null;
}
