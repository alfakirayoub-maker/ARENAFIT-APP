/**
 * Live check-in confirmation, decided by SERVER time.
 *
 * Every server response carries `server_now`. We measure the device clock's
 * offset from it once (mid-point of the request to absorb latency), then tick
 * the UI with the device clock + offset. The device clock alone is never
 * trusted: a phone set hours ahead or behind still shows the right state.
 */

/** serverTime − deviceTime, in ms, from one request/response round trip. */
export function measureClockOffset(serverNowIso: string, sentAtMs: number, receivedAtMs: number): number {
  const server = Date.parse(serverNowIso);
  if (Number.isNaN(server)) return 0;
  return server - (sentAtMs + receivedAtMs) / 2;
}

/** Best estimate of the server's current time. */
export function serverTimeMs(clockOffsetMs: number, deviceNowMs: number = Date.now()): number {
  return deviceNowMs + clockOffsetMs;
}

export type CheckInView =
  /** Within the confirmation window: show the live « PASS VALIDÉ ». */
  | { kind: 'live'; remainingMs: number }
  /** Window over (or unknown): show « PASS UTILISÉ » with the redemption time. */
  | { kind: 'used' };

export function checkInView(
  redemption: { confirmationUntil: string | null; clockOffsetMs: number },
  deviceNowMs: number = Date.now(),
): CheckInView {
  if (!redemption.confirmationUntil) return { kind: 'used' };
  const end = Date.parse(redemption.confirmationUntil);
  if (Number.isNaN(end)) return { kind: 'used' };
  const remainingMs = end - serverTimeMs(redemption.clockOffsetMs, deviceNowMs);
  return remainingMs > 0 ? { kind: 'live', remainingMs } : { kind: 'used' };
}
