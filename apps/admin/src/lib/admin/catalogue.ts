import { activitySchema, coachSchema, type ActivityValues, type CoachValues } from '../validation';
import { run, type Db } from './core';

export type CoachRow = CoachValues & { id: string; activity_ids: string[] };
export type ActivityRow = ActivityValues & { id: string; sort_order: number };

type CoachDb = Omit<CoachRow, 'activity_ids'> & { coach_activities: { activity_id: string }[] };

const COACH_SELECT = 'id, slug, display_name, bio, photo_path, is_active, sort_order, coach_activities(activity_id)';
const toCoach = (c: CoachDb): CoachRow => ({
  id: c.id,
  slug: c.slug,
  display_name: c.display_name,
  bio: c.bio,
  photo_path: c.photo_path,
  is_active: c.is_active,
  sort_order: c.sort_order,
  activity_ids: c.coach_activities.map((a) => a.activity_id),
});

export async function listCoaches(db: Db): Promise<CoachRow[]> {
  const rows = await run<CoachDb[]>(db.from('coaches').select(COACH_SELECT).order('sort_order').order('display_name').returns<CoachDb[]>());
  return rows.map(toCoach);
}

export async function getCoach(db: Db, id: string): Promise<CoachRow> {
  return toCoach(await run<CoachDb>(db.from('coaches').select(COACH_SELECT).eq('id', id).returns<CoachDb[]>().single()));
}

export async function saveCoach(db: Db, id: string | null, input: unknown, activityIds?: string[]): Promise<string> {
  const values = coachSchema.parse(input);
  const saved = id
    ? await run<{ id: string }>(db.from('coaches').update(values).eq('id', id).select('id').single())
    : await run<{ id: string }>(db.from('coaches').insert(values).select('id').single());
  if (activityIds) await run(db.rpc('admin_set_coach_activities', { p_coach_id: saved.id, p_activity_ids: activityIds }));
  return saved.id;
}

export async function setCoachActive(db: Db, id: string, active: boolean): Promise<void> {
  await run(db.from('coaches').update({ is_active: active }).eq('id', id).select('id').single());
}

const ACTIVITY_SELECT =
  'id, slug, name, category, short_description, description, intensity, default_duration_min, equipment, image_path, is_active, is_featured, sort_order';

export const listActivities = (db: Db) =>
  run<ActivityRow[]>(db.from('activities').select(ACTIVITY_SELECT).order('sort_order').order('name').returns<ActivityRow[]>());

export const getActivity = (db: Db, id: string) =>
  run<ActivityRow>(db.from('activities').select(ACTIVITY_SELECT).eq('id', id).returns<ActivityRow[]>().single());

export async function saveActivity(db: Db, id: string | null, input: unknown): Promise<string> {
  const values = activitySchema.parse(input);
  const saved = id
    ? await run<{ id: string }>(db.from('activities').update(values).eq('id', id).select('id').single())
    : await run<{ id: string }>(db.from('activities').insert(values).select('id').single());
  return saved.id;
}

export async function setActivityActive(db: Db, id: string, active: boolean): Promise<void> {
  await run(db.from('activities').update({ is_active: active }).eq('id', id).select('id').single());
}
