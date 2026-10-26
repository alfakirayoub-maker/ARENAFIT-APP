/**
 * Planning editing rules (pure, unit-tested).
 */

/** Warning (never a block) when a coach doesn't usually teach the activity. */
export function coachActivityWarning(
  pairs: Map<string, Set<string>> | undefined,
  coachId: string | null,
  activityId: string | null,
): string | null {
  if (!pairs || !coachId || !activityId) return null;
  return pairs.get(coachId)?.has(activityId)
    ? null
    : 'Ce coach n’est pas habituellement associé à cette activité. Vous pouvez enregistrer quand même (remplacement, exception).';
}

/** End time from a start time and a duration, capped at 23:59. */
export function suggestEndTime(start: string, minutes: number | null | undefined): string | null {
  if (!minutes || !/^\d{2}:\d{2}$/.test(start)) return null;
  const [h, m] = start.split(':').map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Unique, sorted dates other than the source date. */
export function normalizeDuplicateDates(dates: string[], sourceDate: string): string[] {
  return [...new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d !== sourceDate))].sort();
}
