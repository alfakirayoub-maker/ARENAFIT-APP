import i18n from '@/i18n';
import { addDays, clubNow, formatDayLong } from '@/lib/club-time';
import type { ClassSession } from '@/types/domain';

/** True once the class has started (club-local time). */
export function hasStarted(session: ClassSession, now = clubNow()): boolean {
  return session.date < now.date || (session.date === now.date && session.startTime <= now.time);
}

/** True once the class has ended (club-local time). */
export function hasEnded(session: ClassSession, now = clubNow()): boolean {
  return session.date < now.date || (session.date === now.date && session.endTime <= now.time);
}

export function upcomingSessions(sessions: ClassSession[], now = clubNow()): ClassSession[] {
  return sessions.filter((s) => !s.isCancelled && !hasStarted(s, now));
}

/** "Aujourd’hui", "Demain" or "Mardi 27 octobre". */
export function relativeDayLabel(date: string, now = clubNow()): string {
  if (date === now.date) return i18n.t('common.today');
  if (date === addDays(now.date, 1)) return i18n.t('common.tomorrow');
  return formatDayLong(date);
}

export function coachLabel(session: ClassSession): string | null {
  return session.coach ? `Coach ${session.coach.displayName}` : null;
}
