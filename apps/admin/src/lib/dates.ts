/**
 * Club-local calendar helpers. Planning dates and times are Arena Fit
 * wall-clock values (Africa/Casablanca), stored and edited as-is — never
 * converted to UTC. Dates are 'YYYY-MM-DD' strings, times 'HH:MM'.
 */
import { clubWallClock } from './club-clock';

export type ClubDate = string;

const toUtc = (d: ClubDate) => new Date(`${d}T00:00:00Z`);
const fromUtc = (d: Date): ClubDate => d.toISOString().slice(0, 10);

export function isClubDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = toUtc(value);
  return !Number.isNaN(d.getTime()) && fromUtc(d) === value;
}

export function addDays(date: ClubDate, days: number): ClubDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Monday of the week containing `date`. */
export function weekStart(date: ClubDate): ClubDate {
  const dow = toUtc(date).getUTCDay(); // 0 = Sunday
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

export function weekDates(monday: ClubDate): ClubDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' });

/** « lundi 26 octobre » */
export function formatDayLong(date: ClubDate): string {
  return fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(toUtc(date));
}

/** « lun. 26 » */
export function formatDayShort(date: ClubDate): string {
  return fmt({ weekday: 'short', day: 'numeric' }).format(toUtc(date));
}

/** « 26 oct. 2026 » */
export function formatDate(date: ClubDate): string {
  return fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(toUtc(date));
}

/**
 * Instant (ISO) shown in club time: « 25 oct. 2026, 18:45 ». Uses the
 * controlled club offsets (club-clock.ts), not the browser's time zone data,
 * which may not know Morocco's latest rule changes.
 */
export function formatInstant(iso: string | null | undefined): string {
  if (!iso) return '—';
  const { date, time } = clubWallClock(new Date(iso));
  return `${formatDate(date)}, ${time}`;
}

/** Today's club date. */
export function clubToday(now: Date = new Date()): ClubDate {
  return clubWallClock(now).date;
}

/** 'HH:MM:SS' or 'HH:MM' → 'HH:MM'. */
export function hhmm(time: string): string {
  return time.slice(0, 5);
}

/** Dates every `everyDays` after `from`, `count` times (e.g. the next 4 weeks). */
export function repeatDates(from: ClubDate, everyDays: number, count: number): ClubDate[] {
  return Array.from({ length: count }, (_, i) => addDays(from, everyDays * (i + 1)));
}
