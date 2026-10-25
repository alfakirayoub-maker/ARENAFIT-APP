import { z } from 'zod';

import { activityCategories, newsCategories, type Activity, type ClassSession, type Coach, type NewsArticle } from '@/types/domain';

/**
 * Row shapes returned by PostgREST for the select strings below, validated at
 * the boundary so schema drift surfaces as a clear `invalid-data` error
 * instead of a crash deep inside a screen.
 */

export type PublicUrl = (bucket: StorageBucket, path: string | null) => string | null;
export type StorageBucket = 'coaches' | 'activities' | 'classes' | 'news';

const levels = ['all_levels', 'beginner', 'intermediate', 'advanced'] as const;
const hhmm = (t: string) => t.slice(0, 5); // "18:00:00" → "18:00"

// Activities -----------------------------------------------------------------

export const ACTIVITY_SELECT =
  'id, slug, name, category, short_description, description, intensity, equipment, target_muscles, recommended_for, default_duration_min, image_path, is_featured, coach_activities(coach_id)';

export const activityRow = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: z.enum(activityCategories),
  short_description: z.string().nullable(),
  description: z.string().nullable(),
  intensity: z.number().int().nullable(),
  equipment: z.array(z.string()),
  target_muscles: z.array(z.string()),
  recommended_for: z.string().nullable(),
  default_duration_min: z.number().int().nullable(),
  image_path: z.string().nullable(),
  is_featured: z.boolean(),
  coach_activities: z.array(z.object({ coach_id: z.string() })),
});

export function toActivity(row: z.infer<typeof activityRow>, publicUrl: PublicUrl): Activity {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    shortDescription: row.short_description,
    description: row.description,
    intensity: row.intensity,
    equipment: row.equipment,
    targetMuscles: row.target_muscles,
    recommendedFor: row.recommended_for,
    durationMin: row.default_duration_min,
    imageUrl: publicUrl('activities', row.image_path),
    isFeatured: row.is_featured,
    coachIds: row.coach_activities.map((c) => c.coach_id),
  };
}

// Coaches --------------------------------------------------------------------

export const COACH_SELECT = 'id, slug, display_name, bio, photo_path, coach_activities(activity_id)';

export const coachRow = z.object({
  id: z.string(),
  slug: z.string(),
  display_name: z.string(),
  bio: z.string().nullable(),
  photo_path: z.string().nullable(),
  coach_activities: z.array(z.object({ activity_id: z.string() })),
});

export function toCoach(row: z.infer<typeof coachRow>, publicUrl: PublicUrl): Coach {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    bio: row.bio,
    photoUrl: publicUrl('coaches', row.photo_path),
    activityIds: row.coach_activities.map((a) => a.activity_id),
  };
}

// Sessions -------------------------------------------------------------------

export const SESSION_SELECT =
  'id, session_date, start_time, end_time, level, description, is_cancelled, image_path, ' +
  'activity:activities!inner(id, slug, name, category, image_path), ' +
  'coach:coaches(id, slug, display_name, photo_path), ' +
  'room:rooms(name)';

export const sessionRow = z.object({
  id: z.string(),
  session_date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  level: z.enum(levels),
  description: z.string().nullable(),
  is_cancelled: z.boolean(),
  image_path: z.string().nullable(),
  activity: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    category: z.enum(activityCategories),
    image_path: z.string().nullable(),
  }),
  // Null when unassigned, or hidden by RLS (inactive coach / room).
  coach: z.object({ id: z.string(), slug: z.string(), display_name: z.string(), photo_path: z.string().nullable() }).nullable(),
  room: z.object({ name: z.string() }).nullable(),
});

export function toSession(row: z.infer<typeof sessionRow>, publicUrl: PublicUrl): ClassSession {
  return {
    id: row.id,
    date: row.session_date,
    startTime: hhmm(row.start_time),
    endTime: hhmm(row.end_time),
    activity: {
      id: row.activity.id,
      slug: row.activity.slug,
      name: row.activity.name,
      category: row.activity.category,
      // A session-specific image overrides the activity cover.
      imageUrl: publicUrl('classes', row.image_path) ?? publicUrl('activities', row.activity.image_path),
    },
    coach: row.coach
      ? {
          id: row.coach.id,
          slug: row.coach.slug,
          displayName: row.coach.display_name,
          photoUrl: publicUrl('coaches', row.coach.photo_path),
        }
      : null,
    room: row.room?.name ?? null,
    level: row.level,
    description: row.description,
    isCancelled: row.is_cancelled,
  };
}

// News -----------------------------------------------------------------------

export const NEWS_SELECT = 'id, slug, category, title, excerpt, body, cover_path, published_at';

export const newsRow = z.object({
  id: z.string(),
  slug: z.string(),
  category: z.enum(newsCategories),
  title: z.string(),
  excerpt: z.string(),
  body: z.string(),
  cover_path: z.string().nullable(),
  published_at: z.string(),
});

export function toNews(row: z.infer<typeof newsRow>, publicUrl: PublicUrl): NewsArticle {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    coverUrl: publicUrl('news', row.cover_path),
    publishedAt: new Date(row.published_at).toISOString(),
  };
}
