import { z } from 'zod';

import { isClubDate } from './dates';

/**
 * Form schemas (shared by forms and repositories). Messages are French and
 * shown next to the field. The database re-checks everything (constraints,
 * RLS); these exist for fast, friendly feedback.
 */
/** « 18h30 », « 18.30 », « 1830 », « 9:05 » → « 18:30 » / « 09:05 »; anything else is left for the regex to refuse. */
export function normalizeTime(value: string): string {
  const m = /^\s*(\d{1,2})\s*[:hH.]?\s*(\d{2})\s*$/.exec(value);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : value.trim();
}
const time = z
  .string()
  .transform(normalizeTime)
  .pipe(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure au format 24 h, ex. 18:30'));
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .transform((v) => (v === '' ? null : v))
    .nullable();
const slug = z
  .string()
  .trim()
  .min(2, 'Identifiant trop court')
  .max(60, 'Identifiant trop long')
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Minuscules, chiffres et tirets uniquement');

export const LEVELS = ['all_levels', 'beginner', 'intermediate', 'advanced'] as const;
export const VISIBILITIES = ['public', 'members', 'hidden'] as const;
export const CATEGORIES = ['fitness', 'combat', 'dance', 'aqua', 'kids', 'cycling', 'mind_body'] as const;
export const NEWS_CATEGORIES = ['announcement', 'equipment', 'offer', 'event', 'kids', 'challenge', 'schedule', 'wellness'] as const;
export const NOTIFICATION_CATEGORIES = ['schedule_change', 'club_news', 'event', 'announcement'] as const;

export const sessionSchema = z
  .object({
    activity_id: z.uuid('Choisissez une activité'),
    coach_id: z.uuid().nullable(),
    room_id: z.uuid().nullable(),
    session_date: z.string().refine(isClubDate, 'Date invalide'),
    start_time: time,
    end_time: time,
    level: z.enum(LEVELS),
    visibility: z.enum(VISIBILITIES),
    description: optionalText(1000),
    image_path: z.string().nullable(),
  })
  .refine((s) => s.end_time > s.start_time, { path: ['end_time'], message: 'La fin doit être après le début' });
export type SessionInput = z.input<typeof sessionSchema>;
export type SessionValues = z.output<typeof sessionSchema>;

export const coachSchema = z.object({
  slug,
  display_name: z.string().trim().min(1, 'Nom requis').max(40, '40 caractères maximum'),
  bio: optionalText(1200),
  photo_path: z.string().nullable(),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(999),
});
export type CoachValues = z.output<typeof coachSchema>;

const textList = z
  .string()
  .transform((v) =>
    v
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().max(40)).max(12, '12 éléments maximum'));

export const activitySchema = z.object({
  slug,
  name: z.string().trim().min(1, 'Nom requis').max(60, '60 caractères maximum'),
  category: z.enum(CATEGORIES),
  short_description: optionalText(160),
  description: optionalText(2000),
  intensity: z.number().int().min(1).max(5).nullable(),
  default_duration_min: z.number().int().min(5, '5 min minimum').max(240, '240 min maximum').nullable(),
  equipment: textList,
  image_path: z.string().nullable(),
  is_active: z.boolean(),
  is_featured: z.boolean(),
});
export type ActivityValues = z.output<typeof activitySchema>;

export const newsSchema = z.object({
  slug,
  category: z.enum(NEWS_CATEGORIES),
  title: z.string().trim().min(1, 'Titre requis').max(120, '120 caractères maximum'),
  excerpt: z.string().trim().min(1, 'Description courte requise').max(240, '240 caractères maximum'),
  body: z.string().trim().min(1, 'Texte requis').max(20000),
  cover_path: z.string().nullable(),
});
export type NewsValues = z.output<typeof newsSchema>;

export const notificationSchema = z
  .object({
    category: z.enum(NOTIFICATION_CATEGORIES),
    title: z.string().trim().min(1, 'Titre requis').max(80, '80 caractères maximum'),
    body: z.string().trim().min(1, 'Message requis').max(300, '300 caractères maximum'),
    deep_link: z
      .string()
      .trim()
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .refine((v) => v === null || /^arenafit:\/\/[A-Za-z0-9/_-]*$/.test(v), 'Lien interne arenafit:// uniquement'),
    audience: z.enum(['all', 'activity_preference']),
    audience_activity_ids: z.array(z.uuid()),
  })
  .refine((n) => n.audience !== 'activity_preference' || n.audience_activity_ids.length > 0, {
    path: ['audience_activity_ids'],
    message: 'Choisissez au moins une activité',
  });
export type NotificationValues = z.output<typeof notificationSchema>;

export const stationNameSchema = z.string().trim().min(1, 'Nom requis').max(80, '80 caractères maximum');

/** Field errors as { field: message } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_');
    out[key] ??= issue.message;
  }
  return out;
}

/** Slug from a title: « Body Pump » → body-pump. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}
