/// <reference types="node" />
/**
 * Club clock tests — run with `npm test` (Node's built-in runner).
 * Executed under several device timezones (see package.json) to prove the
 * results never depend on the device's tz database.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  CLUB_UTC_OFFSETS,
  clubInstant,
  clubNow,
  clubOffsetMinutesAt,
  clubWallClock,
} from '../src/lib/club-clock.ts';

const iso = (d: Date) => d.toISOString();

describe('offsets around the 2026-09-20 switch to permanent UTC+0', () => {
  it('is UTC+1 just before the switch and UTC+0 from it', () => {
    assert.equal(clubOffsetMinutesAt(new Date('2026-09-20T00:59:59Z')), 60);
    assert.equal(clubOffsetMinutesAt(new Date('2026-09-20T01:00:00Z')), 0);
  });

  it('stays UTC+0 afterwards, including the former Ramadan/summer periods', () => {
    for (const t of ['2026-10-25T12:00:00Z', '2027-02-15T12:00:00Z', '2027-07-01T12:00:00Z', '2030-01-01T00:00:00Z']) {
      assert.equal(clubOffsetMinutesAt(new Date(t)), 0, t);
    }
  });

  it('applied the Ramadan 2026 UTC+0 period', () => {
    assert.equal(clubOffsetMinutesAt(new Date('2026-02-20T12:00:00Z')), 0);
    assert.equal(clubOffsetMinutesAt(new Date('2026-04-01T12:00:00Z')), 60);
  });
});

describe('clubInstant (club wall clock → instant)', () => {
  it('resolves an evening class the day before the switch with UTC+1', () => {
    assert.equal(iso(clubInstant('2026-09-19', '18:00')), '2026-09-19T17:00:00.000Z');
  });

  it('resolves the same class on the switch day with UTC+0', () => {
    assert.equal(iso(clubInstant('2026-09-20', '18:00')), '2026-09-20T18:00:00.000Z');
  });

  it('resolves classes after the switch with UTC+0', () => {
    assert.equal(iso(clubInstant('2026-09-21', '07:00')), '2026-09-21T07:00:00.000Z');
    assert.equal(iso(clubInstant('2026-10-25', '18:30')), '2026-10-25T18:30:00.000Z');
  });

  it('picks the earlier instant for the repeated hour (01:00–01:59 on 2026-09-20)', () => {
    assert.equal(iso(clubInstant('2026-09-20', '01:30')), '2026-09-20T00:30:00.000Z');
    assert.equal(iso(clubInstant('2026-09-20', '01:59')), '2026-09-20T00:59:00.000Z');
    assert.equal(iso(clubInstant('2026-09-20', '02:00')), '2026-09-20T02:00:00.000Z');
  });

  it('shifts a non-existent time forward (end of Ramadan 2026, 02:00→03:00)', () => {
    assert.equal(iso(clubInstant('2026-03-22', '02:30')), '2026-03-22T02:30:00.000Z');
    assert.equal(clubWallClock(clubInstant('2026-03-22', '02:30')).time, '03:30');
  });

  it('round-trips with clubWallClock for regular times', () => {
    for (const [date, time] of [
      ['2026-09-19', '07:00'],
      ['2026-09-20', '12:00'],
      ['2026-12-31', '23:59'],
      ['2027-03-01', '19:15'],
    ] as const) {
      assert.deepEqual(clubWallClock(clubInstant(date, time)), { date, time });
    }
  });

  it('rejects malformed input', () => {
    assert.throws(() => clubInstant('2026-9-20', '18:00'), RangeError);
    assert.throws(() => clubInstant('2026-09-20', '6pm'), RangeError);
  });
});

describe('clubNow / clubWallClock (instant → club wall clock)', () => {
  it('crosses midnight with the right offset before the switch', () => {
    assert.deepEqual(clubNow(new Date('2026-09-19T23:30:00Z')), { date: '2026-09-20', time: '00:30' });
  });

  it('shows the repeated hour twice across the switch', () => {
    assert.deepEqual(clubWallClock(new Date('2026-09-20T00:30:00Z')), { date: '2026-09-20', time: '01:30' });
    assert.deepEqual(clubWallClock(new Date('2026-09-20T01:30:00Z')), { date: '2026-09-20', time: '01:30' });
  });

  it('does not shift by an hour after the switch (stale-ICU regression)', () => {
    // Engines with pre-2026e tz data report 17:30 here; the club clock must not.
    assert.deepEqual(clubNow(new Date('2026-10-25T16:30:00Z')), { date: '2026-10-25', time: '16:30' });
  });
});

describe('parity with the database', () => {
  it('matches public.club_utc_offsets in the migration', () => {
    const sql = readFileSync(new URL('../../../supabase/migrations/20261025120000_club_clock.sql', import.meta.url), 'utf8');
    const rows = [...sql.matchAll(/\('(-infinity|[\d-]+ [\d:]+\+00)',\s*(-?\d+),/g)].map(([, from, minutes]) => ({
      from: from === '-infinity' ? null : `${from.replace(' ', 'T').replace('+00', '')}Z`,
      offsetMinutes: Number(minutes),
    }));
    assert.deepEqual(rows, CLUB_UTC_OFFSETS);
  });
});
