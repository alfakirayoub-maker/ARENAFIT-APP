import { getSimulatedPermission, setSimulatedPermission } from './simulated-permission';
import type { NotificationScheduler } from './types';

/**
 * Web / development stand-in. Browser push is deliberately NOT used: on the web
 * the reminder flow is only previewed. Scheduled "notifications" are kept in
 * memory so the UI, reconciliation and permission screens can be reviewed —
 * nothing is ever delivered.
 */
export const CLASS_REMINDER_CHANNEL_ID = 'class-reminders';

export function createPlatformScheduler(): NotificationScheduler {
  const pending = new Map<string, unknown>();
  let next = 1;

  return {
    kind: 'simulated',
    async getPermission() {
      return getSimulatedPermission();
    },
    async requestPermission() {
      // The simulated "OS prompt" accepts; preview a refusal from Profil › Développement.
      if (getSimulatedPermission() === 'undetermined') setSimulatedPermission('granted');
      return getSimulatedPermission();
    },
    async schedule({ content }) {
      const id = `web-preview-${next++}`;
      pending.set(id, content.data);
      return id;
    },
    async cancel(id) {
      pending.delete(id);
    },
    async listScheduled() {
      return [...pending].map(([id, data]) => ({ id, data }));
    },
    async openSettings() {
      // No system settings on the web preview: simulate the user enabling notifications there.
      setSimulatedPermission('granted');
    },
  };
}
