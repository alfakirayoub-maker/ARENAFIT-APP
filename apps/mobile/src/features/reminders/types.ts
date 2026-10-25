/**
 * Class reminders ("Me le rappeler") — a local notification before a class.
 * Never a reservation.
 */

export const reminderOffsets = [15, 30, 60, 120] as const;
export type ReminderOffset = (typeof reminderOffsets)[number];

/** What is persisted on the device for each reminder (one per session). */
export type ReminderRecord = {
  sessionId: string;
  activityId: string;
  activitySlug: string;
  /** Snapshots at scheduling time — used for the notification copy and to detect changes. */
  title: string;
  coachName: string | null;
  /** Club-local wall clock of the class. */
  date: string;
  startTime: string;
  offsetMinutes: ReminderOffset;
  /** Real instant the notification fires (ISO 8601, from the club clock). */
  triggerAt: string;
  /** OS notification id; null when not scheduled natively (web preview, reminders turned off). */
  notificationId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Notification permission as the app needs to reason about it. */
export type PermissionState =
  | 'granted'
  /** Never asked: we may explain, then ask once. */
  | 'undetermined'
  /** Refused, and the OS won't show the prompt again: only Settings can change it. */
  | 'denied'
  /** No native notifications on this platform (web preview). */
  | 'unavailable';

export type NotificationContent = {
  title: string;
  body: string;
  data: ClassReminderPayload;
};

/** Routing payload attached to every class reminder notification. */
export type ClassReminderPayload = {
  type: 'class-reminder';
  sessionId: string;
};

/**
 * Platform layer: the only thing that talks to the OS notification APIs.
 * Implementations: Expo (iOS/Android) and a simulated one for web/dev.
 */
export interface NotificationScheduler {
  /** 'native' delivers real notifications; 'simulated' only records them (web preview). */
  readonly kind: 'native' | 'simulated';
  getPermission(): Promise<PermissionState>;
  /** Shows the OS prompt when allowed; never re-prompts after a refusal. */
  requestPermission(): Promise<PermissionState>;
  schedule(request: { content: NotificationContent; triggerAt: Date }): Promise<string>;
  cancel(notificationId: string): Promise<void>;
  /** Class reminders currently pending in the OS. */
  listScheduled(): Promise<{ id: string; data: unknown }[]>;
  openSettings(): Promise<void>;
}

export interface ReminderPersistence {
  load(): Promise<ReminderRecord[]>;
  save(records: ReminderRecord[]): Promise<void>;
}

/** Translation function (i18next `t` compatible). */
export type Translate = (key: string, params?: Record<string, string | number>) => string;
