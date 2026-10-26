import { z } from 'zod';

import type { ClubDate } from '../dates';
import { sessionSchema, type SessionInput } from '../validation';
import { run, runParsed, type Db } from './core';

export type SessionRow = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  level: 'all_levels' | 'beginner' | 'intermediate' | 'advanced';
  visibility: 'public' | 'members' | 'hidden';
  is_cancelled: boolean;
  cancellation_note: string | null;
  description: string | null;
  image_path: string | null;
  activity_id: string;
  coach_id: string | null;
  room_id: string | null;
  activity: { id: string; name: string; category: string } | null;
  coach: { id: string; display_name: string } | null;
  room: { id: string; name: string } | null;
};

const SELECT =
  'id, session_date, start_time, end_time, level, visibility, is_cancelled, cancellation_note, description, image_path, ' +
  'activity_id, coach_id, room_id, activity:activities(id, name, category), coach:coaches(id, display_name), room:rooms(id, name)';

export const listSessions = (db: Db, range: { from: ClubDate; to: ClubDate }) =>
  run<SessionRow[]>(
    db
      .from('class_sessions')
      .select(SELECT)
      .gte('session_date', range.from)
      .lte('session_date', range.to)
      .order('session_date')
      .order('start_time')
      .returns<SessionRow[]>(),
  );

export const getSession = (db: Db, id: string) =>
  run<SessionRow>(db.from('class_sessions').select(SELECT).eq('id', id).returns<SessionRow[]>().single());

/** Validated values; times are club wall-clock (stored as-is). */
export function toSessionRow(input: SessionInput) {
  return sessionSchema.parse(input);
}

export async function createSession(db: Db, input: SessionInput): Promise<string> {
  const values = toSessionRow(input);
  const row = await run<{ id: string }>(db.from('class_sessions').insert(values).select('id').single());
  return row.id;
}

export async function updateSession(db: Db, id: string, input: SessionInput): Promise<void> {
  const values = toSessionRow(input);
  await run(db.from('class_sessions').update(values).eq('id', id).select('id').single());
}

export async function cancelSession(db: Db, id: string, note: string | null): Promise<void> {
  await run(db.from('class_sessions').update({ is_cancelled: true, cancellation_note: note?.trim() || null }).eq('id', id).select('id').single());
}

export async function restoreSession(db: Db, id: string): Promise<void> {
  await run(db.from('class_sessions').update({ is_cancelled: false, cancellation_note: null }).eq('id', id).select('id').single());
}

export async function deleteSession(db: Db, id: string): Promise<void> {
  await run(db.from('class_sessions').delete().eq('id', id).select('id').single());
}

const duplicateResult = z.object({ created: z.array(z.uuid()), skipped: z.array(z.string()) });
export const duplicateSession = (db: Db, id: string, dates: ClubDate[]) =>
  runParsed(duplicateResult, db.rpc('admin_duplicate_session', { p_session_id: id, p_dates: dates }));

export type Room = { id: string; name: string; is_active: boolean };
export const listRooms = (db: Db) => run<Room[]>(db.from('rooms').select('id, name, is_active').order('sort_order').order('name'));

/** coach_id → activity ids, to warn when a coach isn't usually on an activity. */
export async function coachActivityMap(db: Db): Promise<Map<string, Set<string>>> {
  const rows = await run<{ coach_id: string; activity_id: string }[]>(db.from('coach_activities').select('coach_id, activity_id'));
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!map.has(r.coach_id)) map.set(r.coach_id, new Set());
    map.get(r.coach_id)!.add(r.activity_id);
  }
  return map;
}
