/**
 * Tiny signal so the data layer can ask for a reminder reconciliation (after
 * a planning refresh) without importing the reminder UI layer.
 */
const handlers = new Set<() => void>();

export function onReconcileRequest(handler: () => void) {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

/** Ask the mounted <ReminderSync> to reconcile now. */
export function requestReminderReconciliation() {
  handlers.forEach((h) => h());
}
