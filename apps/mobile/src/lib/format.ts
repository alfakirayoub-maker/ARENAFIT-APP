import i18n from '@/i18n';

/**
 * Club-local time formatting. All schedule times are shown in the club's
 * timezone, whatever the device timezone is.
 */
export const CLUB_TIME_ZONE = 'Africa/Casablanca';

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: CLUB_TIME_ZONE,
  }).format(new Date(iso));
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`;
}

export function durationMinutes(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
}
