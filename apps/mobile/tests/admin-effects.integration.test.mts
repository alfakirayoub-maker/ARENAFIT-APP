/// <reference types="node" />
/**
 * Dashboard → mobile: what a content manager changes in the admin dashboard
 * reaches the member app through the public repository, and saved class
 * reminders reconcile against it (moved → rescheduled, cancelled/hidden → removed).
 *
 *   SUPABASE_TEST_URL=… SUPABASE_TEST_ANON_KEY=… SUPABASE_TEST_SERVICE_KEY=… npm test
 *
 * The content manager writes with their own signed-in session (RLS decides);
 * the service role only creates that staff account and cleans up.
 * Skipped when the variables are not set.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { createPublicClient } from '../src/data/supabase/client.ts';
import { createSupabaseRepository } from '../src/data/supabase/repository.ts';
import { buildRecord, planReconciliation } from '../src/features/reminders/logic.ts';

const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY;
// Local stack only: these tests create and delete users and data — never staging/production.
const local = !!url && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(url);
const skip = !url || !anonKey || !serviceKey ? 'SUPABASE_TEST_URL / _ANON_KEY / _SERVICE_KEY not set' : !local ? 'SUPABASE_TEST_URL is not a local stack — integration tests never run against hosted projects' : false;

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc = (): SupabaseClient => createClient(url!, serviceKey!, opts);

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('Dashboard changes seen by the member app', { skip }, () => {
  let staff: SupabaseClient;
  let staffId: string;
  let activityId: string;
  const sessions: string[] = [];
  const news: string[] = [];
  const files: string[] = [];
  const repo = () => createSupabaseRepository(createPublicClient(url!, anonKey!));
  // A far-future date no fixture uses; "now" is the real clock.
  const day = `2032-0${1 + Math.floor(Math.random() * 9)}-2${Math.floor(Math.random() * 8)}`;
  const now = new Date();

  before(async () => {
    const s = svc();
    // 2032 is reserved for this suite; purge what an interrupted run may have left.
    await s.from('class_sessions').delete().gte('session_date', '2032-01-01').lt('session_date', '2033-01-01');
    const email = `it-${randomUUID()}@arenafit.test`;
    const password = randomUUID();
    const { data } = await s.auth.admin.createUser({ email, password, email_confirm: true });
    staffId = data.user!.id;
    assert.equal((await s.from('admin_users').insert({ user_id: staffId, role: 'content_manager' })).error, null);
    staff = createClient(url!, anonKey!, opts);
    assert.equal((await staff.auth.signInWithPassword({ email, password })).error, null);
    activityId = (await s.from('activities').select('id').eq('is_active', true).limit(1).single()).data!.id;
  });

  after(async () => {
    const s = svc();
    if (sessions.length) await s.from('class_sessions').delete().in('id', sessions);
    if (news.length) await s.from('news').delete().in('id', news);
    if (files.length) await s.storage.from('classes').remove(files);
    await s.auth.admin.deleteUser(staffId);
  });

  const newSession = async () => {
    const { data, error } = await staff
      .from('class_sessions')
      .insert({ activity_id: activityId, session_date: day, start_time: '18:00', end_time: '18:45', level: 'all_levels', visibility: 'public' })
      .select('id')
      .single();
    assert.equal(error, null);
    sessions.push(data!.id);
    return data!.id as string;
  };

  const reconcile = async (id: string, record: ReturnType<typeof buildRecord>) => {
    const found = await repo().getSessionsByIds([id]);
    return planReconciliation([record], new Map(found.map((s) => [s.id, s])), now, null)[0];
  };

  it('18:00 → 19:00: the app shows 19:00 and the saved reminder is rescheduled', async () => {
    const id = await newSession();
    const before = await repo().getSession(id);
    assert.equal(before?.startTime, '18:00');
    const record = buildRecord(before!, 30, now);

    assert.equal((await staff.from('class_sessions').update({ start_time: '19:00', end_time: '19:45' }).eq('id', id)).error, null);
    assert.equal((await repo().getSession(id))?.startTime, '19:00');
    const action = await reconcile(id, record);
    assert.equal(action.type, 'reschedule');
    assert.ok(action.type === 'reschedule' && action.previousStartTime === '18:00' && action.session.startTime === '19:00');
  });

  it('cancelled: shown as cancelled, left out of upcoming, reminder removed', async () => {
    const id = await newSession();
    const record = buildRecord((await repo().getSession(id))!, 15, now);
    assert.equal((await staff.from('class_sessions').update({ is_cancelled: true, cancellation_note: 'Coach absent' }).eq('id', id)).error, null);
    assert.equal((await repo().getSession(id))?.isCancelled, true);
    const upcoming = await repo().listUpcomingSessions({ now: { date: day, time: '00:00' }, limit: 200, activityId });
    assert.ok(!upcoming.some((s) => s.id === id));
    assert.deepEqual(await reconcile(id, record), { type: 'remove', record, reason: 'cancelled' });
  });

  it('hidden: no longer public, reminder removed', async () => {
    const id = await newSession();
    const record = buildRecord((await repo().getSession(id))!, 60, now);
    assert.equal((await staff.from('class_sessions').update({ visibility: 'hidden' }).eq('id', id)).error, null);
    assert.equal(await repo().getSession(id), null);
    assert.deepEqual(await reconcile(id, record), { type: 'remove', record, reason: 'deleted' });
  });

  it('news: published appears, unpublished disappears', async () => {
    const slug = `it-${randomUUID().slice(0, 8)}`;
    const { data } = await staff
      .from('news')
      .insert({ slug, category: 'announcement', title: 'Test', excerpt: 'Résumé', body: 'Texte', status: 'draft' })
      .select('id')
      .single();
    news.push(data!.id);
    assert.equal(await repo().getNews(slug), null);
    await staff.from('news').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', data!.id);
    assert.equal((await repo().getNews(slug))?.title, 'Test');
    assert.ok((await repo().listNews()).some((n) => n.slug === slug));
    await staff.from('news').update({ status: 'draft', published_at: null }).eq('id', data!.id);
    assert.equal(await repo().getNews(slug), null);
    assert.ok(!(await repo().listNews()).some((n) => n.slug === slug));
  });

  it('images: an uploaded session image is served to the app; without one it falls back to the activity image (or none)', async () => {
    const id = await newSession();
    const activityImage = (await svc().from('activities').select('image_path').eq('id', activityId).single()).data!.image_path;
    const fallback = await repo().getSession(id);
    assert.equal(fallback?.activity.imageUrl?.endsWith(activityImage ?? '') ?? null, activityImage ? true : null, 'null → the app draws its placeholder');

    const key = `it/${randomUUID()}.png`;
    assert.equal((await staff.storage.from('classes').upload(key, PNG, { contentType: 'image/png' })).error, null);
    files.push(key);
    await staff.from('class_sessions').update({ image_path: key }).eq('id', id);
    const withImage = await repo().getSession(id);
    assert.ok(withImage?.activity.imageUrl?.endsWith(key));
    const res = await fetch(withImage!.activity.imageUrl!);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
  });
});
