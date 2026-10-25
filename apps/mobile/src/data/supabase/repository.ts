import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';

import { DataError } from '../errors';
import type { ContentRepository } from '../repository';

import {
  ACTIVITY_SELECT,
  COACH_SELECT,
  NEWS_SELECT,
  SESSION_SELECT,
  activityRow,
  coachRow,
  newsRow,
  sessionRow,
  toActivity,
  toCoach,
  toNews,
  toSession,
  type PublicUrl,
} from './rows';

type Result = { data: unknown; error: PostgrestError | null; status: number };

/** Turns a PostgREST response into validated rows or a DataError. */
async function rows<T extends z.ZodType>(schema: T, request: PromiseLike<Result>): Promise<z.infer<T>[]> {
  let res: Result;
  try {
    res = await request;
  } catch (cause) {
    throw new DataError('network', 'Network request failed', { cause });
  }
  if (res.error) {
    // status 0 = the request never reached the server (offline, timeout, DNS).
    const kind = res.status === 0 ? 'network' : res.status >= 500 ? 'server' : 'rejected';
    throw new DataError(kind, res.error.message, { cause: res.error });
  }
  const parsed = schema.array().safeParse(res.data ?? []);
  if (!parsed.success) throw new DataError('invalid-data', 'Unexpected response shape', { cause: parsed.error });
  return parsed.data;
}

const first = <T>(list: T[]): T | null => list[0] ?? null;

/**
 * Supabase-backed public content. Reads only — RLS restricts the anon role to
 * public content; the explicit filters below are defence in depth so a
 * signed-in admin never sees drafts or hidden sessions inside the member app.
 */
export function createSupabaseRepository(client: SupabaseClient): ContentRepository {
  const publicUrl: PublicUrl = (bucket, path) => (path ? client.storage.from(bucket).getPublicUrl(path).data.publicUrl : null);

  const activities = () => client.from('activities').select(ACTIVITY_SELECT).eq('is_active', true);
  const coaches = () => client.from('coaches').select(COACH_SELECT).eq('is_active', true);
  const sessions = () =>
    client
      .from('class_sessions')
      .select(SESSION_SELECT)
      .neq('visibility', 'hidden')
      .order('session_date')
      .order('start_time');
  const news = () =>
    client
      .from('news')
      .select(NEWS_SELECT)
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false });

  return {
    async listSessions({ from, to }) {
      const list = await rows(sessionRow, sessions().gte('session_date', from).lte('session_date', to));
      return list.map((r) => toSession(r, publicUrl));
    },

    async listUpcomingSessions({ now, limit, activityId, coachId }) {
      let q = sessions()
        .eq('is_cancelled', false)
        // Later day, or today and not started yet (club-local wall clock).
        .or(`session_date.gt.${now.date},and(session_date.eq.${now.date},start_time.gt.${now.time})`)
        .limit(limit);
      if (activityId) q = q.eq('activity_id', activityId);
      if (coachId) q = q.eq('coach_id', coachId);
      const list = await rows(sessionRow, q);
      return list.map((r) => toSession(r, publicUrl));
    },

    async getSession(id) {
      const row = first(await rows(sessionRow, sessions().eq('id', id).limit(1)));
      return row ? toSession(row, publicUrl) : null;
    },

    async listActivities() {
      const list = await rows(activityRow, activities().order('sort_order').order('name'));
      return list.map((r) => toActivity(r, publicUrl));
    },

    async getActivity(slug) {
      const row = first(await rows(activityRow, activities().eq('slug', slug).limit(1)));
      return row ? toActivity(row, publicUrl) : null;
    },

    async listCoachesForActivity(activityId) {
      // `teaches` filters; `coach_activities` still returns every pairing.
      const list = await rows(
        coachRow,
        client
          .from('coaches')
          .select(`${COACH_SELECT}, teaches:coach_activities!inner(activity_id)`)
          .eq('is_active', true)
          .eq('teaches.activity_id', activityId)
          .order('sort_order'),
      );
      return list.map((r) => toCoach(r, publicUrl));
    },

    async listCoaches() {
      const list = await rows(coachRow, coaches().order('sort_order').order('display_name'));
      return list.map((r) => toCoach(r, publicUrl));
    },

    async getCoach(slug) {
      const row = first(await rows(coachRow, coaches().eq('slug', slug).limit(1)));
      return row ? toCoach(row, publicUrl) : null;
    },

    async listActivitiesForCoach(coachId) {
      const list = await rows(
        activityRow,
        client
          .from('activities')
          .select(`${ACTIVITY_SELECT}, taught:coach_activities!inner(coach_id)`)
          .eq('is_active', true)
          .eq('taught.coach_id', coachId)
          .order('sort_order'),
      );
      return list.map((r) => toActivity(r, publicUrl));
    },

    async listNews() {
      const list = await rows(newsRow, news());
      return list.map((r) => toNews(r, publicUrl));
    },

    async getNews(slug) {
      const row = first(await rows(newsRow, news().eq('slug', slug).limit(1)));
      return row ? toNews(row, publicUrl) : null;
    },
  };
}
