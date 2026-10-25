import { createPersistedStore } from '@/lib/persisted-store';

/**
 * Favorite activity ids, kept on the device. Development builds start with a
 * few favorites so screens can be reviewed populated.
 */
const store = createPersistedStore<string[]>(
  'favorite-activities',
  __DEV__ ? ['activity-rpm', 'activity-body-pump', 'activity-body-combat', 'activity-mobility'] : [],
);

export function useFavoriteActivities() {
  const ids = store.useStore();
  return {
    ids,
    isFavorite: (activityId: string) => ids.includes(activityId),
    toggle: (activityId: string) =>
      store.set((prev) => (prev.includes(activityId) ? prev.filter((id) => id !== activityId) : [...prev, activityId])),
  };
}

