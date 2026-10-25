/// <reference types="node" />
/**
 * Supabase repository against a real Supabase/PostgREST API loaded with
 * supabase/seed.sql + supabase/fixtures/dev.sql.
 *
 *   SUPABASE_TEST_URL=http://localhost:54321 SUPABASE_TEST_ANON_KEY=… npm run test:integration
 *
 * Skipped when the variables are not set. Uses the anon key only, exactly like
 * the app.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DataError } from '../src/data/errors.ts';
import { createPublicClient } from '../src/data/supabase/client.ts';
import { createSupabaseRepository } from '../src/data/supabase/repository.ts';
import { addDaysUtc, startOfWeekUtc } from './support/dates.ts';
import { clubInstant, clubNow } from '../src/lib/club-clock.ts';

const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const skip = !url || !anonKey ? 'SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY not set' : false;

const client = url && anonKey ? createPublicClient(url, anonKey) : null;
const repo = client ? createSupabaseRepository(client) : null;

describe('Supabase content repository', { skip }, () => {
  it('lists exactly the real coach roster, in order', async () => {
    const coaches = await repo!.listCoaches();
    assert.deepEqual(
      coaches.map((c) => c.displayName),
      ['ANAS L', 'ANAS D', 'ABDELLAH', 'BADR', 'HAMZA', 'ALI', 'YOUSRA'],
    );
  });

  it('returns coach details and the activities a coach teaches', async () => {
    const hamza = await repo!.getCoach('hamza');
    assert.ok(hamza);
    assert.equal(hamza.activityIds.length, 8);
    const classes = await repo!.listActivitiesForCoach(hamza.id);
    assert.deepEqual(
      classes.map((a) => a.name).sort(),
      ['Biking Adventure', 'Body Combat', 'Core / Mobility', 'Mobility', 'RPM', 'Sprint', 'Sprint-Core', 'Stretching'],
    );
    assert.equal(await repo!.getCoach('not-a-coach'), null);
  });

  it('returns the coaches of an activity with their full class lists', async () => {
    const pump = await repo!.getActivity('body-pump');
    assert.ok(pump);
    const coaches = await repo!.listCoachesForActivity(pump.id);
    assert.deepEqual(coaches.map((c) => c.displayName), ['ANAS L', 'ABDELLAH', 'BADR', 'ALI', 'YOUSRA']);
    // The relationship filter must not truncate each coach's own pairings.
    assert.equal(coaches.find((c) => c.displayName === 'ANAS L')?.activityIds.length, 4);
  });

  it('lists activities with nullable details and no image URL when no image exists', async () => {
    const activities = await repo!.listActivities();
    assert.equal(activities.length, 19);
    const synergy = activities.find((a) => a.slug === 'arenas-synergy');
    assert.equal(synergy?.description, null);
    assert.equal(synergy?.imageUrl, null);
  });

  it('lists a week of sessions in club-local order with HH:MM times', async () => {
    const monday = startOfWeekUtc(clubNow().date);
    const sessions = await repo!.listSessions({ from: monday, to: addDaysUtc(monday, 6) });
    assert.ok(sessions.length > 0);
    for (const s of sessions) {
      assert.match(s.startTime, /^\d{2}:\d{2}$/);
      assert.ok(s.date >= monday && s.date <= addDaysUtc(monday, 6));
    }
    const keys = sessions.map((s) => `${s.date} ${s.startTime}`);
    assert.deepEqual(keys, [...keys].sort());
    // Session detail matches the list item.
    assert.deepEqual(await repo!.getSession(sessions[0].id), sessions[0]);
  });

  it('lists upcoming sessions relative to club time, filterable by activity and coach', async () => {
    const monday = startOfWeekUtc(clubNow().date);
    const sunday = addDaysUtc(monday, 6);
    const upcoming = await repo!.listUpcomingSessions({ now: { date: sunday, time: '18:00' }, limit: 3 });
    assert.equal(upcoming[0].date, sunday);
    assert.equal(upcoming[0].startTime, '18:30');
    assert.ok(upcoming.every((s) => s.date > sunday || s.startTime > '18:00'));

    const rpm = await repo!.getActivity('rpm');
    const onlyRpm = await repo!.listUpcomingSessions({ now: { date: monday, time: '00:00' }, limit: 10, activityId: rpm!.id });
    assert.ok(onlyRpm.length > 0 && onlyRpm.every((s) => s.activity.slug === 'rpm'));

    const ali = await repo!.getCoach('ali');
    const onlyAli = await repo!.listUpcomingSessions({ now: { date: monday, time: '00:00' }, limit: 10, coachId: ali!.id });
    assert.ok(onlyAli.length > 0 && onlyAli.every((s) => s.coach?.displayName === 'ALI'));
  });

  it('fetches sessions by id for reminder reconciliation (missing and non-UUID ids are simply absent)', async () => {
    const monday = startOfWeekUtc(clubNow().date);
    const [a, b] = await repo!.listSessions({ from: monday, to: addDaysUtc(monday, 6) });
    const found = await repo!.getSessionsByIds([a.id, b.id, '00000000-0000-0000-0000-000000000000', 'session-from-fixtures']);
    assert.deepEqual(found.map((s) => s.id).sort(), [a.id, b.id].sort());
    assert.deepEqual(await repo!.getSessionsByIds([]), []);
  });

  it('returns published news only, newest first', async () => {
    const news = await repo!.listNews();
    assert.ok(news.length > 0);
    assert.ok(!news.some((n) => n.slug === 'brouillon-demo'), 'drafts are never returned');
    const dates = news.map((n) => n.publishedAt);
    assert.deepEqual(dates, [...dates].sort().reverse());
    assert.equal(await repo!.getNews('brouillon-demo'), null);
    assert.equal((await repo!.getNews(news[0].slug))?.title, news[0].title);
  });

  it('resolves club instants on the server exactly like the app clock', async () => {
    for (const [d, t] of [
      ['2026-09-19', '18:00'],
      ['2026-09-20', '01:30'],
      ['2026-09-20', '18:00'],
      ['2026-03-22', '02:30'],
      ['2027-02-15', '19:00'],
    ] as const) {
      const { data, error } = await client!.rpc('club_instant', { d, t });
      assert.equal(error, null);
      assert.equal(new Date(data as string).toISOString(), clubInstant(d, t).toISOString(), `${d} ${t}`);
    }
  });

  it('rejects writes from the anon key (RLS)', async () => {
    const { error, status } = await client!.from('coaches').insert({ slug: 'fake', display_name: 'FAKE' });
    assert.ok(error);
    assert.equal(error.code, '42501');
    assert.ok(status === 401 || status === 403);
  });

  it('maps failures to DataError kinds', async () => {
    const badKey = createSupabaseRepository(createPublicClient(url!, 'not-a-valid-key'));
    await assert.rejects(badKey.listCoaches(), (e: unknown) => e instanceof DataError && e.kind === 'rejected');

    const unreachable = createSupabaseRepository(createPublicClient('http://127.0.0.1:9', anonKey!));
    await assert.rejects(unreachable.listCoaches(), (e: unknown) => e instanceof DataError && e.kind === 'network' && e.retryable);
  });
});
