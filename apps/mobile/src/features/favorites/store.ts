import { createPersistedStore } from '@/lib/persisted-store';

/**
 * Favorite activities, kept on the device (no account needed).
 *
 * Stored by activity **slug**, not database id: slugs are stable across
 * environments and data sources, so the list can later be migrated to the
 * member's `favorite_activities` rows once activation exists (slug → id lookup
 * at sync time). Development builds start with a few favorites so screens can
 * be reviewed populated.
 */
const store = createPersistedStore<string[]>(
  'favorite-activities.v2',
  __DEV__ ? ['rpm', 'body-pump', 'body-combat', 'mobility'] : [],
);

export function useFavoriteActivities() {
  const slugs = store.useStore();
  return {
    slugs,
    isFavorite: (activitySlug: string) => slugs.includes(activitySlug),
    toggle: (activitySlug: string) =>
      store.set((prev) => (prev.includes(activitySlug) ? prev.filter((s) => s !== activitySlug) : [...prev, activitySlug])),
  };
}
