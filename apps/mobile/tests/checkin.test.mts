/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { checkInView, measureClockOffset, serverTimeMs } from '../src/features/guest-pass/checkin.ts';
import { cameraAccess, ScanController, type ScanPhase } from '../src/features/guest-pass/scan-controller.ts';
import type { RedemptionResult } from '../src/features/guest-pass/types.ts';

const VALID = `AFR1.${'k'.repeat(43)}`;
const SERVER_REDEEMED = '2026-10-25T17:45:00.000Z';
const SERVER_WINDOW_END = '2026-10-25T17:47:00.000Z'; // + 120 s
const at = (iso: string) => Date.parse(iso);

describe('confirmation window (server time)', () => {
  it('measures the offset at the request mid-point', () => {
    assert.equal(measureClockOffset('2026-10-25T17:45:00.000Z', at('2026-10-25T17:44:59.000Z'), at('2026-10-25T17:44:59.200Z')), 900);
    assert.equal(measureClockOffset('not a date', 0, 0), 0);
    assert.equal(serverTimeMs(500, 1000), 1500);
  });

  it('is live right after redemption, then switches to used when the window ends', () => {
    const r = { confirmationUntil: SERVER_WINDOW_END, clockOffsetMs: 0 };
    assert.deepEqual(checkInView(r, at('2026-10-25T17:45:01Z')), { kind: 'live', remainingMs: 119_000 });
    assert.deepEqual(checkInView(r, at('2026-10-25T17:46:59Z')), { kind: 'live', remainingMs: 1_000 });
    assert.deepEqual(checkInView(r, at('2026-10-25T17:47:00Z')), { kind: 'used' });
    assert.deepEqual(checkInView(r, at('2026-10-25T19:00:00Z')), { kind: 'used' });
  });

  it('app reopened inside the window → live; after it → used (from the server response)', () => {
    // Reopen 30 s after redemption: get_my_guest_pass says server_now = 17:45:30.
    const deviceNow = at('2026-10-25T17:45:30.000Z');
    const offset = measureClockOffset('2026-10-25T17:45:30.000Z', deviceNow, deviceNow);
    assert.equal(checkInView({ confirmationUntil: SERVER_WINDOW_END, clockOffsetMs: offset }, deviceNow).kind, 'live');
    // Reopen an hour later.
    const later = at('2026-10-25T18:45:30.000Z');
    const offset2 = measureClockOffset('2026-10-25T18:45:30.000Z', later, later);
    assert.equal(checkInView({ confirmationUntil: SERVER_WINDOW_END, clockOffsetMs: offset2 }, later).kind, 'used');
  });

  it('a wrong device clock does not change the decision', () => {
    // Device 3 h behind: a replay one hour later must still be "used".
    const deviceNow = at('2026-10-25T15:45:30.000Z'); // real server time 18:45:30
    const offset = measureClockOffset('2026-10-25T18:45:30.000Z', deviceNow, deviceNow);
    assert.equal(checkInView({ confirmationUntil: SERVER_WINDOW_END, clockOffsetMs: offset }, deviceNow).kind, 'used');
    // Device 2 days ahead, 10 s after redemption: still live.
    const ahead = at('2026-10-27T17:45:10.000Z');
    const offset2 = measureClockOffset('2026-10-25T17:45:10.000Z', ahead, ahead);
    const view = checkInView({ confirmationUntil: SERVER_WINDOW_END, clockOffsetMs: offset2 }, ahead);
    assert.deepEqual(view, { kind: 'live', remainingMs: 110_000 });
    // …and it ticks down with the device clock.
    assert.equal(checkInView({ confirmationUntil: SERVER_WINDOW_END, clockOffsetMs: offset2 }, ahead + 111_000).kind, 'used');
  });

  it('no window (not redeemed, or missing) → never live', () => {
    assert.deepEqual(checkInView({ confirmationUntil: null, clockOffsetMs: 0 }), { kind: 'used' });
    assert.deepEqual(checkInView({ confirmationUntil: 'garbage', clockOffsetMs: 0 }), { kind: 'used' });
  });
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

const redeemed: RedemptionResult = {
  result: 'redeemed',
  redeemedAt: SERVER_REDEEMED,
  stationName: 'Réception principale',
  sessions: 1,
  confirmationUntil: SERVER_WINDOW_END,
  clockOffsetMs: 0,
};

function setup(redeem: (qr: string) => Promise<RedemptionResult>) {
  const phases: ScanPhase[] = [];
  const timers: (() => void)[] = [];
  const controller = new ScanController({
    redeem,
    onChange: (p) => phases.push(p),
    setTimer: (fn) => timers.push(fn),
    clearTimer: () => {},
  });
  return { controller, phases, timers };
}

describe('scanner duplicate-request protection', () => {
  it('many frames of the same valid QR → ONE request', async () => {
    const calls: string[] = [];
    const d = deferred<RedemptionResult>();
    const { controller, phases } = setup((qr) => (calls.push(qr), d.promise));
    for (let i = 0; i < 30; i++) controller.onScan(VALID);
    assert.equal(calls.length, 1);
    assert.equal(controller.current.kind, 'validating');
    d.resolve(redeemed);
    await d.promise;
    await Promise.resolve();
    assert.deepEqual(controller.current, { kind: 'done', result: redeemed });
    controller.onScan(VALID);
    assert.equal(calls.length, 1, 'no request after the result either');
    assert.deepEqual(
      phases.map((p) => p.kind),
      ['validating', 'done'],
    );
  });

  it('unrecognised codes stay inline, send nothing, and scanning continues', async () => {
    const calls: string[] = [];
    const { controller, timers } = setup(async (qr) => (calls.push(qr), redeemed));
    controller.onScan('https://example.com/promo');
    controller.onScan('https://example.com/promo');
    assert.deepEqual(controller.current, { kind: 'scanning', notice: 'unrecognized' });
    assert.equal(calls.length, 0);
    timers.at(-1)!();
    assert.deepEqual(controller.current, { kind: 'scanning', notice: null });
    controller.onScan(VALID);
    assert.equal(calls.length, 1, 'a valid QR is still accepted afterwards');
  });

  it('network failure → retry repeats the same payload once; never a local "used"', async () => {
    const calls: string[] = [];
    let fail = true;
    const { controller } = setup(async (qr) => {
      calls.push(qr);
      if (fail) throw new Error('offline');
      return redeemed;
    });
    controller.onScan(VALID);
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(controller.current, { kind: 'network_error' });
    controller.onScan(VALID); // frames during the error panel are ignored
    assert.equal(calls.length, 1);
    fail = false;
    controller.retry();
    controller.retry(); // double tap
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(calls, [VALID, VALID]);
    assert.equal(controller.current.kind, 'done');
  });

  it('rescan clears the held payload', async () => {
    const calls: string[] = [];
    const { controller } = setup(async (qr) => {
      calls.push(qr);
      throw new Error('offline');
    });
    controller.onScan(VALID);
    await new Promise((r) => setTimeout(r, 0));
    controller.rescan();
    controller.retry();
    assert.equal(calls.length, 1, 'retry after cancel sends nothing');
  });
});

describe('camera permission states', () => {
  it('maps every state and never re-asks after a denial', () => {
    assert.equal(cameraAccess(null), 'checking');
    assert.equal(cameraAccess({ granted: true, status: 'granted', canAskAgain: true }), 'granted');
    assert.equal(cameraAccess({ granted: false, status: 'undetermined', canAskAgain: true }), 'ask');
    assert.equal(cameraAccess({ granted: false, status: 'denied', canAskAgain: true }), 'denied', 'Android first denial');
    assert.equal(cameraAccess({ granted: false, status: 'denied', canAskAgain: false }), 'denied', 'blocked / restricted');
    assert.equal(cameraAccess({ granted: false, status: 'undetermined', canAskAgain: false }), 'denied', 'restricted (iOS)');
  });
});
