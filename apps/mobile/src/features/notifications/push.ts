/**
 * REMOTE PUSH — interface only. Nothing here is wired or sends anything.
 *
 * Remote notifications (club news, offers & events, schedule changes) are
 * completed once member activation / device registration exists. Planned flow:
 *
 *   1. After the user opts in (Profil › Notifications), the app gets an Expo
 *      push token with `getExpoPushTokenAsync({ projectId })` (needs the EAS
 *      project id, a development/production build, FCM v1 credentials on
 *      Android and an APNs key on iOS — see docs/DEV_BUILD.md).
 *   2. The token is registered through an authenticated Supabase RPC (never a
 *      public insert) into `device_tokens`, together with the user's category
 *      preferences (`notification_preferences`).
 *   3. Admins compose a campaign in the admin dashboard (`notifications`
 *      table); a Supabase Edge Function holding the Expo access token resolves
 *      the audience server-side and calls the Expo Push API in batches.
 *   4. Payloads carry a typed routing object (like `class-reminder`), handled by
 *      `routeForNotificationData`; raw URLs are never followed.
 *
 * Not built yet, deliberately: no token collection, no public endpoint, no
 * sending code, no fake tokens.
 */

export type RemoteNotificationCategory = 'news' | 'offersEvents' | 'scheduleChanges';

export interface PushRegistrationService {
  /** Returns the Expo push token, or null when unavailable / not permitted. */
  getPushToken(): Promise<string | null>;
  /** Registers (or refreshes) this device for the given categories. Requires an identity. */
  register(token: string, categories: RemoteNotificationCategory[]): Promise<void>;
  unregister(token: string): Promise<void>;
}
