/// <reference types="node" />
/**
 * Dashboard repositories against a real Supabase stack (Auth + PostgREST +
 * Storage) with the migrations applied, signed in as each staff role through
 * the same code the pages use.
 *
 *   SUPABASE_TEST_URL=http://localhost:54321 SUPABASE_TEST_ANON_KEY=… \
 *   SUPABASE_TEST_SERVICE_KEY=… npm test
 *
 * The service-role key is used ONLY by this harness (create staff users,
 * inspect stored rows, clean up). The dashboard never has it.
 * Skipped when the variables are not set.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { listAudit } from '../src/lib/admin/audit.ts';
import { saveActivity, saveCoach, setActivityActive, setCoachActive } from '../src/lib/admin/catalogue.ts';
import { listInvitations, cancelInvitation } from '../src/lib/admin/guest-passes.ts';
import { getStaffIdentity } from '../src/lib/admin/identity.ts';
import { listMembers } from '../src/lib/admin/members.ts';
import { publishNews, saveNews, unpublishNews } from '../src/lib/admin/news.ts';
import { saveNotificationDraft } from '../src/lib/admin/notifications.ts';
import { cancelSession, createSession, duplicateSession, getSession, updateSession } from '../src/lib/admin/planning.ts';
import { getDashboardStats } from '../src/lib/admin/stats.ts';
import { createStation, listStations, rotateStation, setStationActive } from '../src/lib/admin/stations.ts';
import { publicImageUrl, uploadImage } from '../src/lib/admin/storage.ts';
import { AdminError } from '../src/lib/errors.ts';
import type { StaffRole } from '../src/lib/roles.ts';

const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY;
// Local stack only: these tests create and delete users and data — never staging/production.
const local = !!url && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(url);
const skip = !url || !anonKey || !serviceKey ? 'SUPABASE_TEST_URL / _ANON_KEY / _SERVICE_KEY not set' : !local ? 'SUPABASE_TEST_URL is not a local stack — integration tests never run against hosted projects' : false;

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc = (): SupabaseClient => createClient(url!, serviceKey!, opts);
const anon = (): SupabaseClient => createClient(url!, anonKey!, opts);

const created = { users: [] as string[], sessions: [] as string[], news: [] as string[], coaches: [] as string[], activities: [] as string[], stations: [] as string[], files: [] as [string, string][] };

/** A signed-in user; staff role assigned by the harness (service role), never by the user. */
async function signedIn(role: StaffRole | 'member' | null) {
  const email = `it-${randomUUID()}@arenafit.test`;
  const password = randomUUID();
  const s = svc();
  const { data, error } = await s.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(error, null);
  const id = data.user!.id;
  created.users.push(id);
  if (role === 'member') {
    assert.equal((await s.from('profiles').update({ kind: 'member', first_name: 'Membre' }).eq('id', id)).error, null);
    const today = new Date().toISOString().slice(0, 10);
    assert.equal((await s.from('memberships').insert({ profile_id: id, plan_name: 'Test', membership_type: 'test', starts_on: today })).error, null);
  } else if (role) {
    assert.equal((await s.from('admin_users').insert({ user_id: id, role, display_name: `IT ${role}` })).error, null);
  }
  const client = anon();
  assert.equal((await client.auth.signInWithPassword({ email, password })).error, null);
  return { id, client };
}

const forbidden = (p: Promise<unknown>) =>
  assert.rejects(p, (e: unknown) => e instanceof AdminError && (e.kind === 'forbidden' || e.kind === 'not_found'), 'expected a refusal');

/** PostgREST silently filters rows RLS hides: an update "succeeds" on 0 rows → not_found. */
const firstActivityId = async () => (await svc().from('activities').select('id').eq('is_active', true).limit(1).single()).data!.id as string;

const session = (activityId: string, date: string, start = '18:00', end = '18:45') => ({
  activity_id: activityId,
  coach_id: null,
  room_id: null,
  session_date: date,
  start_time: start,
  end_time: end,
  level: 'all_levels' as const,
  visibility: 'public' as const,
  description: null,
  image_path: null,
});

const pngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('Admin dashboard (integration)', { skip }, () => {
  let admin: Awaited<ReturnType<typeof signedIn>>;
  let content: Awaited<ReturnType<typeof signedIn>>;
  let reception: Awaited<ReturnType<typeof signedIn>>;
  let member: Awaited<ReturnType<typeof signedIn>>;
  let activityId: string;
  // 2031 is reserved for this suite (no fixture uses it); purged first so a run
  // that died before its cleanup can't leave a slot that a later run collides with.
  const day = `2031-0${1 + Math.floor(Math.random() * 9)}-1${Math.floor(Math.random() * 9)}`;

  before(async () => {
    await svc().from('class_sessions').delete().gte('session_date', '2031-01-01').lt('session_date', '2032-01-01');
    [admin, content, reception, member] = await Promise.all([signedIn('admin'), signedIn('content_manager'), signedIn('reception'), signedIn('member')]);
    activityId = await firstActivityId();
  });

  after(async () => {
    const s = svc();
    if (created.sessions.length) await s.from('class_sessions').delete().in('id', created.sessions);
    if (created.news.length) await s.from('news').delete().in('id', created.news);
    if (created.coaches.length) await s.from('coaches').delete().in('id', created.coaches);
    if (created.activities.length) await s.from('activities').delete().in('id', created.activities);
    if (created.stations.length) await s.from('reception_stations').delete().in('id', created.stations);
    for (const [bucket, key] of created.files) await s.storage.from(bucket).remove([key]);
    for (const id of created.users) await s.auth.admin.deleteUser(id);
  });

  describe('sign-in and roles', () => {
    it('each staff account resolves to its role; members and plain users are not staff', async () => {
      assert.equal((await getStaffIdentity(admin.client))?.role, 'admin');
      assert.equal((await getStaffIdentity(content.client))?.role, 'content_manager');
      assert.equal((await getStaffIdentity(reception.client))?.role, 'reception');
      assert.equal(await getStaffIdentity(member.client), null);
      assert.equal(await getStaffIdentity((await signedIn(null)).client), null);
    });

    it('nobody can grant themselves a role', async () => {
      const r = await member.client.from('admin_users').insert({ user_id: member.id, role: 'admin' });
      assert.ok(r.error, 'insert refused');
      await content.client.from('admin_users').update({ role: 'admin' }).eq('user_id', content.id);
      assert.equal((await getStaffIdentity(content.client))?.role, 'content_manager');
    });

    it('members and anonymous visitors cannot call admin RPCs', async () => {
      await forbidden(getDashboardStats(member.client));
      await forbidden(listStations(member.client));
      await forbidden(listInvitations(member.client, {}));
      await forbidden(listMembers(member.client));
      await forbidden(listAudit(member.client));
      const a = anon();
      for (const fn of ['admin_dashboard_stats', 'admin_list_reception_stations', 'admin_list_audit_log', 'admin_list_members']) {
        assert.ok((await a.rpc(fn)).error, `${fn} refused for anon`);
      }
    });

    it('public and members cannot read the audit log or staff list', async () => {
      for (const c of [anon(), member.client]) {
        assert.deepEqual((await c.from('admin_audit_log').select('id').limit(1)).data ?? [], []);
        assert.deepEqual((await c.from('admin_users').select('user_id').limit(1)).data ?? [], []);
      }
    });
  });

  describe('content manager', () => {
    it('creates, edits, duplicates and cancels a session', async () => {
      const db = content.client;
      const id = await createSession(db, session(activityId, day));
      created.sessions.push(id);
      await updateSession(db, id, session(activityId, day, '19:00', '19:45'));
      const s = await getSession(db, id);
      assert.equal(s.start_time.slice(0, 5), '19:00', 'wall-clock value stored as typed');

      const next = new Date(`${day}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 7);
      const d2 = next.toISOString().slice(0, 10);
      const dup = await duplicateSession(db, id, [d2, d2]);
      created.sessions.push(...dup.created);
      assert.equal(dup.created.length, 1, 'same date requested twice → one copy');
      const again = await duplicateSession(db, id, [d2]);
      assert.deepEqual([again.created.length, again.skipped], [0, [d2]], 'an existing identical slot is skipped');

      await cancelSession(db, id, 'Coach absent');
      assert.equal((await getSession(db, id)).is_cancelled, true);

      const log = await listAudit(admin.client, id);
      const actions = log.map((e) => e.action);
      for (const a of ['session.created', 'session.updated', 'session.cancelled']) assert.ok(actions.includes(a), a);
    });

    it('edits a coach and an activity, deactivates them, and cannot delete them', async () => {
      const db = content.client;
      const slug = `it-${randomUUID().slice(0, 8)}`;
      const coachId = await saveCoach(db, null, { slug, display_name: 'IT COACH', bio: null, photo_path: null, is_active: false, sort_order: 999 }, [activityId]);
      created.coaches.push(coachId);
      await saveCoach(db, coachId, { slug, display_name: 'IT COACH 2', bio: 'Bio', photo_path: null, is_active: false, sort_order: 999 });
      await setCoachActive(db, coachId, false);
      const actId = await saveActivity(db, null, {
        slug,
        name: 'IT Activité',
        category: 'fitness',
        short_description: null,
        description: null,
        intensity: 3,
        default_duration_min: 45,
        equipment: '',
        image_path: null,
        is_active: false,
        is_featured: false,
      });
      created.activities.push(actId);
      await setActivityActive(db, actId, false);
      await db.from('coaches').delete().eq('id', coachId);
      assert.equal((await svc().from('coaches').select('display_name').eq('id', coachId).single()).data?.display_name, 'IT COACH 2', 'not deleted');
      const actions = (await listAudit(admin.client, coachId)).map((e) => e.action);
      assert.ok(actions.includes('coach.created') && actions.includes('coach.updated'), actions.join());
    });

    it('news: draft → publish → unpublish, reflected publicly', async () => {
      const db = content.client;
      const slug = `it-${randomUUID().slice(0, 8)}`;
      const id = await saveNews(db, null, { slug, category: 'announcement', title: 'Actualité de test', excerpt: 'Résumé', body: 'Texte', cover_path: null });
      created.news.push(id);
      const pub = () => anon().from('news').select('id').eq('id', id);
      assert.deepEqual((await pub()).data, [], 'draft is not public');
      await publishNews(db, id);
      assert.equal((await pub()).data?.length, 1, 'published is public');
      await unpublishNews(db, id);
      assert.deepEqual((await pub()).data, [], 'unpublished disappears');
      await publishNews(db, id, new Date(Date.now() + 86_400_000));
      assert.deepEqual((await pub()).data, [], 'scheduled is not public yet');
      const actions = (await listAudit(admin.client, id)).map((e) => e.action);
      assert.ok(actions.includes('news.published') && actions.includes('news.unpublished'), actions.join());
    });

    it('notifications: drafts only — never a sent state', async () => {
      const db = content.client;
      const id = await saveNotificationDraft(db, null, { category: 'club_news', title: 'Titre', body: 'Texte', deep_link: null, audience: 'all', audience_activity_ids: [] });
      const row = (await svc().from('notifications').select('status, sent_at').eq('id', id).single()).data;
      assert.deepEqual(row, { status: 'draft', sent_at: null });
      assert.ok((await db.from('notifications').update({ status: 'sent' }).eq('id', id)).error, 'status not writable');
      await svc().from('notifications').delete().eq('id', id);
    });

    it('is refused stations, guest passes, members and the audit log', async () => {
      const db = content.client;
      await forbidden(listStations(db));
      await forbidden(createStation(db, 'Interdit'));
      await forbidden(listInvitations(db, {}));
      await forbidden(listMembers(db));
      await forbidden(listAudit(db));
    });
  });

  describe('reception', () => {
    it('reads guest passes and the station list only', async () => {
      const db = reception.client;
      assert.ok(Array.isArray(await listInvitations(db, {})));
      const stations = await listStations(db);
      assert.ok(stations.length > 0);
      await forbidden(createStation(db, 'Interdit'));
      await forbidden(rotateStation(db, stations[0].id));
      await forbidden(setStationActive(db, stations[0].id, false));
      await forbidden(cancelInvitation(db, randomUUID()));
      await forbidden(createSession(db, session(activityId, day)));
      await forbidden(listMembers(db));
      await forbidden(listAudit(db));
      await forbidden(saveNews(db, null, { slug: 'x-reception', category: 'announcement', title: 't', excerpt: 'e', body: 'b', cover_path: null }));
    });
  });

  describe('admin: reception stations', () => {
    it('create → rotate → deactivate → reactivate; the raw token is never stored or readable', async () => {
      const db = admin.client;
      const first = await createStation(db, `IT Station ${randomUUID().slice(0, 4)}`);
      created.stations.push(first.stationId);
      const rotated = await rotateStation(db, first.stationId);
      assert.notEqual(rotated.qrPayload, first.qrPayload);
      await setStationActive(db, first.stationId, false);
      assert.equal((await listStations(db)).find((s) => s.id === first.stationId)?.active, false);
      await setStationActive(db, first.stationId, true);
      const listed = (await listStations(db)).find((s) => s.id === first.stationId)!;
      assert.equal(listed.active, true);
      assert.ok(listed.last_rotated_at);
      assert.ok(!JSON.stringify(listed).includes(rotated.qrPayload.slice(5)), 'list has no token');

      // Stored row: hash only. Even the admin cannot select the hash column.
      const stored = (await svc().from('reception_stations').select('*').eq('id', first.stationId).single()).data!;
      const dump = JSON.stringify(stored);
      assert.ok(!dump.includes(first.qrPayload.slice(5)) && !dump.includes(rotated.qrPayload.slice(5)), 'raw tokens not persisted');
      assert.ok((await db.from('reception_stations').select('token_hash').eq('id', first.stationId)).error, 'hash not readable');

      // Audit: actions recorded, no token or hash anywhere.
      const log = await listAudit(db, first.stationId);
      assert.deepEqual(
        log.map((e) => e.action).sort(),
        ['station.created', 'station.deactivated', 'station.reactivated', 'station.rotated'],
      );
      const logDump = JSON.stringify(log);
      assert.ok(!logDump.includes(rotated.qrPayload.slice(5)) && !logDump.includes(String(stored.token_hash ?? '')) && !/token|hash/i.test(logDump));
    });

    it('sees members (safe fields only) and the dashboard numbers', async () => {
      const members = await listMembers(admin.client);
      assert.ok(members.length > 0);
      assert.ok(!/password|token|hash/i.test(JSON.stringify(members[0])));
      const stats = await getDashboardStats(admin.client);
      assert.equal(typeof stats.sessions_today, 'number');
    });
  });

  describe('storage', () => {
    it('accepts a real image, serves it publicly; refuses fakes, other types and non-staff', async () => {
      const file = new File([pngBytes], 'photo.png', { type: 'image/png' });
      const key = await uploadImage(content.client, 'coaches', 'it', file);
      created.files.push(['coaches', key]);
      const res = await fetch(publicImageUrl(content.client, 'coaches', key)!);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'image/png');

      const fake = new File(['<script>alert(1)</script>'], 'fake.png', { type: 'image/png' });
      await assert.rejects(uploadImage(content.client, 'coaches', 'it', fake), (e: unknown) => e instanceof AdminError && e.kind === 'invalid');

      // Bypassing the dashboard check, the bucket itself refuses non-images.
      const raw = await content.client.storage.from('coaches').upload(`it/${randomUUID()}.html`, new Blob(['<h1>x</h1>'], { type: 'text/html' }), { contentType: 'text/html' });
      assert.ok(raw.error, 'html refused by the bucket');

      await assert.rejects(uploadImage(member.client, 'coaches', 'it', file));
      await assert.rejects(uploadImage(reception.client, 'coaches', 'it', file));
    });
  });
});
