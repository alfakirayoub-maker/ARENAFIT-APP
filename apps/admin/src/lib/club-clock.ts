/**
 * Copy of apps/mobile/src/lib/club-clock.ts (dependency-free). Both copies are
 * checked against public.club_utc_offsets in the migration by their tests
 * (admin: tests/club-clock.test.mts), so they cannot drift silently.
 */
/**
 * Arena Fit club clock — the ONLY place that converts between real instants
 * and club-local wall-clock time.
 *
 * Why not Intl / the device timezone database? Morocco moved to permanent
 * UTC+0 on 2026-09-20. Devices (and JS engines' bundled ICU) with outdated tz
 * data still apply the old UTC+1 rules for "Africa/Casablanca", which would
 * shift "now" — and every reminder — by an hour. So the club's UTC offsets are
 * controlled here, mirroring `public.club_utc_offsets`
 * (supabase/migrations/20261025120000_club_clock.sql). A test keeps both in sync.
 *
 * Planning values (date + start/end time) are wall-clock and are displayed
 * as-is; only use this module when a real instant is involved (current club
 * time, reminder scheduling, publication timestamps).
 *
 * Pure module: no imports, no device timezone, no Intl.
 */

/** Semantic club timezone (IANA). Informational — never resolved via the device. */
export const CLUB_TIME_ZONE = 'Africa/Casablanca';

export type ClubOffsetRule = {
  /** First instant (ISO 8601, UTC) at which the offset applies; null = since forever. */
  from: string | null;
  /** Club offset from UTC, in minutes. */
  offsetMinutes: number;
};

/**
 * Club UTC offsets, oldest first. Source: IANA tzdata 2026e for
 * Africa/Casablanca (UTC+1 with UTC+0 during Ramadan, then permanent UTC+0
 * from 2026-09-20 01:00 UTC). Earlier history is not modelled (+01 assumed).
 * Add a row here AND in a new migration if the rules change again.
 */
export const CLUB_UTC_OFFSETS: readonly ClubOffsetRule[] = [
  { from: null, offsetMinutes: 60 },
  { from: '2024-03-10T02:00:00Z', offsetMinutes: 0 }, // Ramadan 2024
  { from: '2024-04-14T02:00:00Z', offsetMinutes: 60 },
  { from: '2025-02-23T02:00:00Z', offsetMinutes: 0 }, // Ramadan 2025
  { from: '2025-04-06T02:00:00Z', offsetMinutes: 60 },
  { from: '2026-02-15T02:00:00Z', offsetMinutes: 0 }, // Ramadan 2026
  { from: '2026-03-22T02:00:00Z', offsetMinutes: 60 },
  { from: '2026-09-20T01:00:00Z', offsetMinutes: 0 }, // permanent UTC+0
];

const rules = CLUB_UTC_OFFSETS.map((r) => ({
  from: r.from === null ? -Infinity : Date.parse(r.from),
  offsetMs: r.offsetMinutes * 60_000,
}));
const distinctOffsetsMs = [...new Set(rules.map((r) => r.offsetMs))];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

/** Club UTC offset (minutes) in force at `instant`. */
export function clubOffsetMinutesAt(instant: Date): number {
  return offsetMsAt(instant.getTime()) / 60_000;
}

function offsetMsAt(ms: number): number {
  let offset = rules[0].offsetMs;
  for (const r of rules) {
    if (r.from <= ms) offset = r.offsetMs;
    else break;
  }
  return offset;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Club-local wall clock at `instant`: date "YYYY-MM-DD", time "HH:MM". */
export function clubWallClock(instant: Date): { date: string; time: string } {
  const local = new Date(instant.getTime() + offsetMsAt(instant.getTime()));
  return {
    date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
  };
}

/**
 * Real instant of a club-local date + time.
 *
 * - Ambiguous wall time (clocks went back, e.g. 2026-09-20 01:00–01:59):
 *   the earlier instant wins.
 * - Non-existent wall time (clocks went forward): shifted forward by the gap,
 *   e.g. 02:30 during a 02:00→03:00 jump resolves to 03:30 local.
 */
export function clubInstant(date: string, time: string): Date {
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) {
    throw new RangeError(`Invalid club date/time: ${date} ${time}`);
  }
  const wallAsUtc = Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}Z`);
  if (Number.isNaN(wallAsUtc)) throw new RangeError(`Invalid club date/time: ${date} ${time}`);

  const candidates = distinctOffsetsMs
    .map((offset) => wallAsUtc - offset)
    .filter((ms) => wallAsUtc - offsetMsAt(ms) === ms)
    .sort((a, b) => a - b);
  if (candidates.length > 0) return new Date(candidates[0]);

  // Gap: interpret with the offset in force just before the transition.
  return new Date(wallAsUtc - offsetMsAt(wallAsUtc - 86_400_000));
}

/** Current club-local date and time. */
export function clubNow(now: Date = new Date()): { date: string; time: string } {
  return clubWallClock(now);
}
