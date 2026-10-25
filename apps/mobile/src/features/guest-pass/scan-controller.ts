import { parseReceptionQr } from './links';
import type { RedemptionResult } from './types';

/**
 * Scanner state machine, independent of the camera. Guarantees:
 *  - a recognised Arena Fit QR triggers exactly ONE redemption request; frames
 *    arriving while it runs are ignored (state changes synchronously);
 *  - unrecognised codes never leave the scanner: a short notice, then scanning
 *    continues (the same code isn't re-reported while the notice shows);
 *  - a network failure keeps the scanned payload in memory only, so « Réessayer »
 *    repeats the same request once; the payload is never logged or persisted.
 *    A retry can't redeem twice: the server returns « already used » if the
 *    first request did go through.
 */
export type ScanPhase =
  | { kind: 'scanning'; notice: 'unrecognized' | null }
  | { kind: 'validating' }
  | { kind: 'network_error' }
  | { kind: 'done'; result: RedemptionResult };

export type ScanControllerOptions = {
  redeem: (receptionQr: string) => Promise<RedemptionResult>;
  onChange: (phase: ScanPhase) => void;
  /** How long the « QR non reconnu » notice stays (ms). */
  noticeMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

export class ScanController {
  private phase: ScanPhase = { kind: 'scanning', notice: null };
  private pending: string | null = null;
  private lastRejected: string | null = null;
  private noticeTimer: unknown = null;
  private readonly opts: Required<ScanControllerOptions>;

  constructor(options: ScanControllerOptions) {
    this.opts = {
      noticeMs: 3000,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      ...options,
    };
  }

  get current(): ScanPhase {
    return this.phase;
  }

  /** Called for every decoded frame. */
  onScan(data: string): void {
    if (this.phase.kind !== 'scanning') return;
    const qr = parseReceptionQr(data);
    if (!qr) {
      if (this.phase.notice === 'unrecognized' && data === this.lastRejected) return;
      this.lastRejected = data;
      this.set({ kind: 'scanning', notice: 'unrecognized' });
      this.opts.clearTimer(this.noticeTimer);
      this.noticeTimer = this.opts.setTimer(() => {
        this.lastRejected = null;
        if (this.phase.kind === 'scanning') this.set({ kind: 'scanning', notice: null });
      }, this.opts.noticeMs);
      return;
    }
    this.pending = qr;
    void this.validate();
  }

  /** « Réessayer » after a network failure: same payload, one request. */
  retry(): void {
    if (this.phase.kind !== 'network_error' || !this.pending) return;
    void this.validate();
  }

  /** Back to scanning (e.g. « Annuler » or « Réessayer » after a refusal). */
  rescan(): void {
    this.pending = null;
    this.lastRejected = null;
    this.set({ kind: 'scanning', notice: null });
  }

  dispose(): void {
    this.opts.clearTimer(this.noticeTimer);
    this.pending = null;
  }

  private async validate(): Promise<void> {
    const qr = this.pending!;
    this.opts.clearTimer(this.noticeTimer);
    this.set({ kind: 'validating' });
    try {
      const result = await this.opts.redeem(qr);
      this.pending = null;
      this.set({ kind: 'done', result });
    } catch {
      this.set({ kind: 'network_error' });
    }
  }

  private set(phase: ScanPhase) {
    this.phase = phase;
    this.opts.onChange(phase);
  }
}

/** Camera permission → what the scanner screen shows. Never re-asks after a denial. */
export type CameraAccess = 'checking' | 'ask' | 'denied' | 'granted';

export function cameraAccess(
  permission: { granted: boolean; status: 'granted' | 'denied' | 'undetermined'; canAskAgain: boolean } | null,
): CameraAccess {
  if (!permission) return 'checking';
  if (permission.granted) return 'granted';
  if (permission.status === 'undetermined' && permission.canAskAgain) return 'ask';
  return 'denied';
}
