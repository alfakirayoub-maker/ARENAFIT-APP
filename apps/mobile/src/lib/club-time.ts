import i18n from '@/i18n';

/**
 * Club-local calendar helpers.
 *
 * The planning is wall-clock time at the club (Africa/Casablanca): a session
 * is a `date` (YYYY-MM-DD) plus `startTime`/`endTime` (HH:MM). Those values are
 * displayed as-is — never converted — so "18:00" is always 18:00 at the club,
 * whatever the device timezone or Morocco's current UTC offset.
 *
 * Only "what time is it at the club right now" needs the timezone database.
 */
export const CLUB_TIME_ZONE = 'Africa/Casablanca';

/** ISO calendar date, e.g. "2026-10-25". */
export type ClubDate = string;
/** 24h wall-clock time, e.g. "18:00". */
export type ClubTime = string;

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLUB_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Current date and time at the club. */
export function clubNow(now: Date = new Date()): { date: ClubDate; time: ClubTime } {
  const p = Object.fromEntries(partsFormatter.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

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

/** "12 oct." — for instants (news publication dates). */
export function formatPublishedAt(iso: string): string {
  return new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: CLUB_TIME_ZONE,
  }).format(new Date(iso));
}
