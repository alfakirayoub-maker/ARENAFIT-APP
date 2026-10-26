/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { buildStationPrintSvg } from '@arenafit/reception-print';

import { newsState } from '../src/lib/admin/news.ts';
import { CLUB_UTC_OFFSETS, clubWallClock } from '../src/lib/club-clock.ts';
import { addDays, formatInstant, isClubDate, repeatDates, weekDates, weekStart } from '../src/lib/dates.ts';
import { toAdminError } from '../src/lib/errors.ts';
import { checkImage, imageKey, MAX_IMAGE_BYTES } from '../src/lib/images.ts';
import { coachActivityWarning, normalizeDuplicateDates, suggestEndTime } from '../src/lib/planning-rules.ts';
import { can } from '../src/lib/roles.ts';
import { activitySchema, newsSchema, notificationSchema, sessionSchema, slugify } from '../src/lib/validation.ts';

const UUID = '00000000-0000-4000-8000-000000000001';

describe('roles (navigation mirror of the database rules)', () => {
  it('admin sees everything', () => {
    for (const c of ['planning', 'news', 'guestPasses', 'stationManage', 'members', 'audit'] as const) assert.ok(can('admin', c), c);
  });
  it('content manager: content only', () => {
    for (const c of ['planning', 'coaches', 'activities', 'news', 'notifications'] as const) assert.ok(can('content_manager', c), c);
    for (const c of ['guestPasses', 'stations', 'stationManage', 'members', 'audit'] as const) assert.ok(!can('content_manager', c), c);
  });
  it('reception: guest passes + station list, nothing else', () => {
    assert.ok(can('reception', 'guestPasses') && can('reception', 'stations'));
    for (const c of ['planning', 'news', 'stationManage', 'guestPassCancel', 'members', 'audit'] as const) assert.ok(!can('reception', c), c);
  });
  it('non-staff: nothing', () => {
    assert.ok(!can(null, 'dashboard'));
  });
});

describe('club-local dates (no UTC conversion of planning values)', () => {
  it('week helpers', () => {
    assert.equal(weekStart('2026-10-28'), '2026-10-26');
    assert.equal(weekStart('2026-11-01'), '2026-10-26', 'Sunday belongs to the week starting Monday');
    assert.deepEqual(weekDates('2026-10-26').at(-1), '2026-11-01');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.deepEqual(repeatDates('2026-11-02', 7, 3), ['2026-11-09', '2026-11-16', '2026-11-23']);
    assert.ok(isClubDate('2026-02-28') && !isClubDate('2026-02-30') && !isClubDate('28/02/2026'));
  });
  it('timestamps are shown in club time using the controlled offsets', () => {
    // 2026-09-19 18:00Z is 19:00 in Casablanca (UTC+1); after 2026-09-20 the club is UTC+0.
    assert.equal(formatInstant('2026-09-19T18:00:00Z').slice(-5), '19:00');
    assert.equal(formatInstant('2026-10-25T18:45:00Z').slice(-5), '18:45');
    assert.equal(formatInstant(null), '—');
  });
  it('the dashboard clock copy matches the database offsets table', () => {
    const sql = readFileSync(new URL('../../../supabase/migrations/20261025120000_club_clock.sql', import.meta.url), 'utf8');
    const rows = [...sql.matchAll(/\('(\d{4}-\d{2}-\d{2}) ([\d:]+)\+00',\s*(-?\d+)/g)].map((m) => [`${m[1]}T${m[2]}Z`, Number(m[3])]);
    assert.ok(rows.length >= 5);
    for (const [from, minutes] of rows) {
      assert.equal(CLUB_UTC_OFFSETS.find((r) => r.from !== null && new Date(r.from).toISOString() === new Date(from as string).toISOString())?.offsetMinutes, minutes, String(from));
    }
    assert.equal(clubWallClock(new Date('2026-10-25T18:45:00Z')).time, '18:45');
  });
});

describe('session form', () => {
  const base = {
    activity_id: UUID,
    coach_id: null,
    room_id: null,
    session_date: '2026-11-02',
    start_time: '18:00',
    end_time: '18:45',
    level: 'all_levels',
    visibility: 'public',
    description: '  ',
    image_path: null,
  } as const;
  it('accepts wall-clock values as-is', () => {
    const v = sessionSchema.parse(base);
    assert.equal(v.start_time, '18:00');
    assert.equal(v.session_date, '2026-11-02');
    assert.equal(v.description, null, 'blank description → null (activity description used)');
  });
  it('times are 24 h club wall-clock; common French spellings are accepted', () => {
    for (const [typed, stored] of [['18h30', '18:30'], ['1830', '18:30'], ['18.30', '18:30'], ['9:05', '09:05'], [' 19:00 ', '19:00']]) {
      assert.equal(sessionSchema.parse({ ...base, start_time: typed, end_time: '23:00' }).start_time, stored, typed);
    }
    for (const bad of ['7:00 PM', '24:00', '18:60', '18', '']) assert.ok(!sessionSchema.safeParse({ ...base, start_time: bad }).success, bad);
  });
  it('rejects bad times and end before start', () => {
    assert.ok(!sessionSchema.safeParse({ ...base, end_time: '17:00' }).success);
    assert.ok(!sessionSchema.safeParse({ ...base, start_time: '25:00' }).success);
    assert.ok(!sessionSchema.safeParse({ ...base, session_date: '2026-13-01' }).success);
    assert.ok(!sessionSchema.safeParse({ ...base, activity_id: '' }).success);
  });
  it('warns (never blocks) when a coach is not usually on the activity', () => {
    const pairs = new Map([['coach-1', new Set(['rpm'])]]);
    assert.equal(coachActivityWarning(pairs, 'coach-1', 'rpm'), null);
    assert.match(coachActivityWarning(pairs, 'coach-1', 'pump') ?? '', /pas habituellement/);
    assert.equal(coachActivityWarning(pairs, null, 'pump'), null);
  });
  it('end time suggestion and duplicate dates', () => {
    assert.equal(suggestEndTime('18:00', 45), '18:45');
    assert.equal(suggestEndTime('23:30', 60), '23:59');
    assert.equal(suggestEndTime('18:00', null), null);
    assert.deepEqual(normalizeDuplicateDates(['2026-11-09', '2026-11-02', '2026-11-09', 'x'], '2026-11-02'), ['2026-11-09']);
  });
});

describe('other forms', () => {
  it('activity: comma list, bounds', () => {
    const v = activitySchema.parse({
      slug: 'body-pump',
      name: 'Body Pump',
      category: 'fitness',
      short_description: '',
      description: 'x',
      intensity: 4,
      default_duration_min: 55,
      equipment: 'Barre, disques, ',
      image_path: null,
      is_active: true,
      is_featured: false,
    });
    assert.deepEqual(v.equipment, ['Barre', 'disques']);
    assert.equal(v.short_description, null);
    assert.ok(!activitySchema.safeParse({ ...v, equipment: '', intensity: 6 }).success);
  });
  it('news slug and required fields', () => {
    assert.equal(slugify('Nouveau planning d’été !'), 'nouveau-planning-d-ete');
    assert.ok(!newsSchema.safeParse({ slug: 'A B', category: 'event', title: 'x', excerpt: 'x', body: 'x', cover_path: null }).success);
  });
  it('notification: in-app deep links only, activity audience needs activities', () => {
    const ok = { category: 'club_news', title: 'T', body: 'B', deep_link: 'arenafit://news/test', audience: 'all', audience_activity_ids: [] } as const;
    assert.ok(notificationSchema.safeParse(ok).success);
    assert.ok(!notificationSchema.safeParse({ ...ok, deep_link: 'https://evil.test' }).success);
    assert.ok(!notificationSchema.safeParse({ ...ok, deep_link: 'javascript:alert(1)' }).success);
    assert.ok(!notificationSchema.safeParse({ ...ok, audience: 'activity_preference' }).success);
    assert.ok(!notificationSchema.safeParse({ ...ok, audience: 'segments' }).success);
  });
  it('news state: draft / scheduled / published', () => {
    const now = new Date('2026-10-26T10:00:00Z');
    assert.equal(newsState({ status: 'draft', published_at: null }, now), 'draft');
    assert.equal(newsState({ status: 'published', published_at: '2026-10-27T08:00:00Z' }, now), 'scheduled');
    assert.equal(newsState({ status: 'published', published_at: '2026-10-25T08:00:00Z' }, now), 'published');
  });
});

describe('image upload validation', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array(12).fill(0)]);
  const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
  const html = new TextEncoder().encode('<script>alert(1)');
  it('accepts real JPEG / PNG / WebP', () => {
    assert.deepEqual(checkImage({ type: 'image/png', size: 1000, name: 'a.png' }, png), { ok: true, mime: 'image/png', ext: 'png' });
    assert.equal(checkImage({ type: 'image/jpeg', size: 1000, name: 'a.jpg' }, jpg).ok, true);
    assert.equal(checkImage({ type: 'image/webp', size: 1000, name: 'a.webp' }, webp).ok, true);
  });
  it('rejects other types, renamed files, empty and oversized files', () => {
    assert.equal(checkImage({ type: 'image/svg+xml', size: 10, name: 'a.svg' }, html).ok, false);
    assert.equal(checkImage({ type: 'application/x-msdownload', size: 10, name: 'a.exe' }, html).ok, false);
    assert.equal(checkImage({ type: 'image/png', size: 10, name: 'fake.png' }, html).ok, false, 'content must match');
    assert.equal(checkImage({ type: 'image/png', size: 0, name: 'a.png' }, png).ok, false);
    assert.equal(checkImage({ type: 'image/png', size: MAX_IMAGE_BYTES + 1, name: 'a.png' }, png).ok, false);
  });
  it('storage keys never reuse the uploaded file name', () => {
    assert.equal(imageKey('photos', 'png', 'abc'), 'photos/abc.png');
    assert.equal(imageKey('../../etc', 'png', 'abc'), 'etc/abc.png');
  });
});

describe('errors are never raw database messages', () => {
  it('maps codes to French messages', () => {
    assert.equal(toAdminError({ code: '42501', message: 'permission denied for table x' }).kind, 'forbidden');
    assert.equal(toAdminError({ code: '23505', message: 'duplicate key' }).kind, 'conflict');
    assert.equal(toAdminError({ code: 'PGRST116', message: '0 rows' }).kind, 'not_found');
    assert.equal(toAdminError({ statusCode: '415', message: 'mime' }).kind, 'invalid');
    assert.ok(!toAdminError({ code: 'XX000', message: 'internal: relation "secret" …' }).message.includes('secret'));
  });
});

describe('reception print asset', () => {
  const payload = `AFR1.${'k'.repeat(43)}`;
  it('encodes the payload in the QR only, never as text', () => {
    for (const format of ['a5', 'a6'] as const) {
      const svg = buildStationPrintSvg({ payload, stationName: 'Réception principale', format, logoHref: 'data:image/png;base64,AAAA' });
      assert.ok(!svg.includes('k'.repeat(10)), `${format}: token not printed`);
      assert.match(svg, /SCANNER POUR UTILISER/);
      assert.match(svg, /Réception principale/);
      assert.match(svg, /Utiliser mon Pass/);
    }
    assert.throws(() => buildStationPrintSvg({ payload: 'https://x', stationName: 'x', format: 'a5', logoHref: '' }));
  });
});

describe('audit log display', () => {
  it('shows changed fields in French, never raw column names', async () => {
    const { changedFields } = await import('../src/lib/admin/audit.ts');
    assert.equal(changedFields({ changed: ['start_time', 'end_time'] }), 'début, fin');
    assert.equal(changedFields({ changed: ['image_path', 'cover_path'] }), 'image');
    assert.equal(changedFields({}), null);
  });
});

describe('presentation photos', () => {
  it('are recognised by their storage prefix only', async () => {
    const { isPresentationImage } = await import('../src/lib/images.ts');
    assert.equal(isPresentationImage('presentation/strength.jpg'), true);
    assert.equal(isPresentationImage('photos/abc.jpg'), false);
    assert.equal(isPresentationImage('covers/presentation/x.jpg'), false);
    assert.equal(isPresentationImage(null), false);
  });
});
