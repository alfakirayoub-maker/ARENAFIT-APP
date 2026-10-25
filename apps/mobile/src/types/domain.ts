/**
 * App-level view models. They mirror the Supabase schema
 * (supabase/migrations) but are shaped for the UI; the data layer (Sprint 3)
 * maps database rows into these types.
 */

export const activityCategories = [
  'fitness',
  'combat',
  'dance',
  'aqua',
  'kids',
  'cycling',
  'mind_body',
] as const;
export type ActivityCategory = (typeof activityCategories)[number];

export type ClassLevel = 'all_levels' | 'beginner' | 'intermediate' | 'advanced';

export type ClassSessionSummary = {
  id: string;
  activityName: string;
  category: ActivityCategory;
  /** ISO 8601 */
  startsAt: string;
  /** ISO 8601 */
  endsAt: string;
  coachName: string | null;
  roomName: string | null;
  level: ClassLevel;
  imageUrl?: string | null;
  isCancelled?: boolean;
};
