// Plain-date helpers for tests (same arithmetic as src/lib/club-time.ts,
// without its i18n dependency).
export function addDaysUtc(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function startOfWeekUtc(date: string): string {
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDaysUtc(date, -weekday);
}
