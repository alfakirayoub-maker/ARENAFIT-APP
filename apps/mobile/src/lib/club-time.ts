import i18n from '@/i18n';

import { clubWallClock } from './club-clock';

export { CLUB_TIME_ZONE, clubInstant, clubNow } from './club-clock';

/**
 * Club-local calendar helpers (formatting and date arithmetic).
 *
 * The planning is wall-clock time at the club: a session is a `date`
 * (YYYY-MM-DD) plus `startTime`/`endTime` (HH:MM), displayed as-is — never
 * converted. Anything involving a real instant goes through ./club-clock,
 * which does not rely on the device's timezone database.
 */

/** ISO calendar date, e.g. "2026-10-25". */
export type ClubDate = string;
/** 24h wall-clock time, e.g. "18:00". */
export type ClubTime = string;

// Calendar arithmetic on plain dates, done in UTC so no device timezone or DST
// can shift a day.
function toUtcDate(date: ClubDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUtcDate(d: Date): ClubDate {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: ClubDate, days: number): ClubDate {
  const d = toUtcDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtcDate(d);
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: ClubDate): ClubDate {
  const weekday = (toUtcDate(date).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(date, -weekday);
}

export function weekDates(monday: ClubDate): ClubDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function minutesOf(time: ClubTime): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function durationMinutes(start: ClubTime, end: ClubTime): number {
  return minutesOf(end) - minutesOf(start);
}

export function formatTimeRange(start: ClubTime, end: ClubTime): string {
  return `${start} – ${end}`;
}

function format(date: ClubDate, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(i18n.language, { ...options, timeZone: 'UTC' }).format(toUtcDate(date));
}

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase(i18n.language) + s.slice(1);
}

/** "Lun" */
export function formatWeekdayShort(date: ClubDate): string {
  return capitalize(format(date, { weekday: 'short' }).replace('.', ''));
}

/** "7" */
export function formatDayOfMonth(date: ClubDate): string {
  return format(date, { day: 'numeric' });
}

/** "Lundi 7 octobre" */
export function formatDayLong(date: ClubDate): string {
  return capitalize(format(date, { weekday: 'long', day: 'numeric', month: 'long' }));
}

/** "Octobre 2026" */
export function formatMonthYear(date: ClubDate): string {
  return capitalize(format(date, { month: 'long', year: 'numeric' }));
}

/** "24/08/2027" */
export function formatDateShort(date: ClubDate): string {
  return format(date, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** "12 oct. 2026" — an instant (e.g. publication time) shown as its club-local date. */
export function formatPublishedAt(iso: string): string {
  return format(clubWallClock(new Date(iso)).date, { day: 'numeric', month: 'short', year: 'numeric' });
}
