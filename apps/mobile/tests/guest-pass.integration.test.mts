/// <reference types="node" />
/**
 * Guest Pass flow against a real Supabase API (Auth + PostgREST) with the
 * migrations applied, through the same repository and identity code as the app.
 *
 *   SUPABASE_TEST_URL=http://localhost:54321 SUPABASE_TEST_ANON_KEY=… \
 *   SUPABASE_TEST_SERVICE_KEY=… npm test
 *
 * The service-role key is used ONLY by this test harness, to create fresh test
 * members, reception stations, and to simulate time passing (expiry). The app
 * never has it.
 * Skipped when the variables are not set.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { createPublicClient, createSessionClient } from '../src/data/supabase/client.ts';
import { createSupabaseIdentityService } from '../src/features/auth/identity.ts';
import { createSupabaseGuestPassRepository } from '../src/features/guest-pass/supabase-repository.ts';
import { GuestPassError, type GuestPassRepository } from '../src/features/guest-pass/types.ts';

const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY;
// Local stack only: these tests create and delete users and data — never staging/production.
const local = !!url && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(url);
const skip = !url || !anonKey || !serviceKey ? 'SUPABASE_TEST_URL / _ANON_KEY / _SERVICE_KEY not set' : !local ? 'SUPABASE_TEST_URL is not a local stack — integration tests never run against hosted projects' : false;

const admin = (): SupabaseClient =>
  createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });

/** A fresh member with an active membership (test harness only). */
async function newMember(firstName: string) {
  const email = `it-${randomUUID()}@arenafit.test`;
  const password = randomUUID();
  const svc = admin();
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(error, null);
  const id = data.user!.id;
  assert.equal((await svc.from('profiles').update({ kind: 'member', first_name: firstName }).eq('id', id)).error, null);
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(
    (await svc.from('memberships').insert({ profile_id: id, plan_name: 'Test', membership_type: 'test', starts_on: today })).error,
    null,
  );
  const client = createSessionClient(url!, anonKey!);
  await createSupabaseIdentityService(client).signInWithPassword(email, password);
  return { id, client, repo: createSupabaseGuestPassRepository(client) };
}

/** A device that has not activated anything yet (no user until ensureGuestIdentity). */
function newDevice() {
  const client = createSessionClient(url!, anonKey!);
  const identity = createSupabaseIdentityService(client);
  return { client, identity, repo: createSupabaseGuestPassRepository(client) };
}

async function guest() {
  const device = newDevice();
  const { user } = await device.identity.ensureGuestIdentity();
  return { ...device, user };
}

const rejectsWith = (p: Promise<unknown>, code: string) =>
  assert.rejects(p, (e: unknown) => e instanceof GuestPassError && e.code === code);

const countProfiles = async () => (await admin().from('profiles').select('id', { count: 'exact', head: true })).count ?? 0;

describe('Guest Pass (integration)', { skip }, () => {
  let ayoub: Awaited<ReturnType<typeof newMember>>;
  before(async () => {
    ayoub = await newMember('Ayoub');
  });

  it('concurrent taps never exceed the balance (3 passes, 5 parallel creations)', async () => {
    const member = await newMember('Concurrent');
    const results = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => member.repo.createInvitation(`Ami ${i}`)));
    const ok = results.filter((r) => r.status === 'fulfilled');
    const refused = results.filter(
      (r) => r.status === 'rejected' && r.reason instanceof GuestPassError && r.reason.code === 'no_pass_available',
    );
    assert.equal(ok.length, 3);
    assert.equal(refused.length, 2);
    const overview = await member.repo.getMyInvitations();
    assert.equal(overview.available, 0);
    assert.equal(overview.invitations.length, 3);
  });

  it('creation returns the secrets once, leaves 2 of 3, and previews without creating any user', async () => {
    const created = await ayoub.repo.createInvitation('Yassine');
    assert.equal(created.available, 2);
    assert.match(created.shortCode, /^AF-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    assert.notEqual(created.shareToken, created.invitationId);

    const profilesBefore = await countProfiles();
    const visitor = newDevice();
    const preview = await visitor.repo.previewInvitation({ token: created.shareToken });
    assert.deepEqual(
      { result: preview.result, inviterName: preview.inviterName, sessions: preview.sessions },
      { result: 'valid', inviterName: 'Ayoub', sessions: 1 },
    );
    assert.equal(await visitor.identity.currentUser(), null, 'opening an invitation creates no identity');
    assert.equal(await countProfiles(), profilesBefore, 'no account per visitor');

    // Hashes only, never the raw values.
    const { data } = await admin().from('guest_invitations').select('link_token_hash, short_code_hash').eq('id', created.invitationId).single();
    const raw = (v: string) => `\\x${Buffer.from(v).toString('hex')}`;
    assert.notEqual(data!.link_token_hash, raw(created.shareToken));
    assert.notEqual(data!.short_code_hash, raw(created.shortCode));
  });

  it('two devices activating the same invitation at once produce ONE pass', async () => {
    const inv = await ayoub.repo.createInvitation('Sara');
    const [a, b] = await Promise.all([guest(), guest()]);
    const results = await Promise.all([
      a.repo.activateInvitation({ token: inv.shareToken }),
      b.repo.activateInvitation({ token: inv.shareToken }),
    ]);
    assert.deepEqual(results.map((r) => r.result).sort(), ['activated', 'already_claimed']);
    const { count } = await admin().from('guest_passes').select('id', { count: 'exact', head: true }).eq('invitation_id', inv.invitationId);
    assert.equal(count, 1);
  });

  it('the same guest activating twice (concurrently, then by code) keeps a single pass', async () => {
    const inv = await ayoub.repo.createInvitation(null);
    const g = await guest();
    const results = await Promise.all([
      g.repo.activateInvitation({ token: inv.shareToken }),
      g.repo.activateInvitation({ token: inv.shareToken }),
    ]);
    assert.deepEqual(results.map((r) => r.result).sort(), ['activated', 'already_active']);

    const again = await g.repo.activateInvitation({ code: inv.shortCode.toLowerCase().replaceAll('-', '') });
    assert.equal(again.result, 'already_active', 'the code resolves the same invitation');
    const { count } = await admin().from('guest_passes').select('id', { count: 'exact', head: true }).eq('invitation_id', inv.invitationId);
    assert.equal(count, 1);

    const pass = await g.repo.getMyGuestPass();
    assert.equal(pass?.status, 'activated');
    assert.equal(pass?.inviterName, 'Ayoub');
  });

  it('one guest activating two different invitations at once gets ONE active pass', async () => {
    const [m1, m2] = await Promise.all([newMember('Un'), newMember('Deux')]);
    const [i1, i2] = await Promise.all([m1.repo.createInvitation(null), m2.repo.createInvitation(null)]);
    const g = await guest();
    const results = await Promise.all([
      g.repo.activateInvitation({ token: i1.shareToken }),
      g.repo.activateInvitation({ token: i2.shareToken }),
    ]);
    assert.deepEqual(results.map((r) => r.result).sort(), ['activated', 'has_active_pass']);
  });

  it('cancel before activation returns the pass; after activation it is refused', async () => {
    const member = await newMember('Annule');
    const pending = await member.repo.createInvitation('Mehdi');
    const claimed = await member.repo.createInvitation('Imane');
    assert.equal((await member.repo.getMyInvitations()).available, 1);

    const g = await guest();
    assert.equal((await g.repo.activateInvitation({ token: claimed.shareToken })).result, 'activated');
    await rejectsWith(member.repo.cancelInvitation(claimed.invitationId), 'not_cancellable');

    assert.equal((await member.repo.cancelInvitation(pending.invitationId)).available, 2);
    await rejectsWith(member.repo.cancelInvitation(pending.invitationId), 'not_cancellable');
    assert.equal((await newDevice().repo.previewInvitation({ token: pending.shareToken })).result, 'cancelled');
    assert.equal((await (await guest()).repo.activateInvitation({ code: pending.shortCode })).result, 'cancelled');
  });

  it('expiry returns the pass exactly once and runs server-side', async () => {
    const member = await newMember('Expire');
    const inv = await member.repo.createInvitation('Nora');
    assert.equal((await member.repo.getMyInvitations()).available, 2);

    const svc = admin();
    await svc.from('guest_invitations').update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', inv.invitationId);
    const first = await svc.rpc('expire_guest_invitations');
    const second = await svc.rpc('expire_guest_invitations');
    assert.ok((first.data as number) >= 1);
    assert.equal(second.data, 0, 're-running changes nothing');

    const overview = await member.repo.getMyInvitations();
    assert.equal(overview.available, 3);
    assert.equal(overview.invitations[0].status, 'expired');
    assert.equal((await newDevice().repo.previewInvitation({ token: inv.shareToken })).result, 'expired');
  });

  it('access control: no enumeration, own data only, no server job from the app', async () => {
    const anon = createPublicClient(url!, anonKey!);
    for (const table of ['guest_invitations', 'guest_passes', 'guest_pass_balances', 'guest_pass_events']) {
      const { error } = await anon.from(table).select('*');
      assert.equal(error?.code, '42501', `anon cannot read ${table}`);
    }
    assert.equal((await anon.rpc('expire_guest_invitations')).error?.code, '42501');
    assert.ok((await anon.rpc('activate_guest_invitation', { p_token: 'x', p_code: null })).error);

    const owner = await newMember('Leila');
    const inv = await owner.repo.createInvitation('Privé');
    const other = await newMember('Karim');
    const { data: visible } = await other.client.from('guest_invitations').select('id');
    assert.deepEqual(visible, [], 'a member does not see another member’s invitations');
    await rejectsWith(other.repo.cancelInvitation(inv.invitationId), 'not_found');
    assert.equal((await other.client.from('guest_invitations').select('link_token_hash')).error?.code, '42501');

    const g1 = await guest();
    await g1.repo.activateInvitation({ token: inv.shareToken });
    const g2 = await guest();
    assert.deepEqual((await g2.client.from('guest_passes').select('id')).data, [], 'a guest does not see another guest’s pass');
    assert.equal(await g2.repo.getMyGuestPass(), null);
    await rejectsWith(g1.repo.createInvitation('x'), 'not_eligible');
    assert.equal((await owner.repo.activateInvitation({ token: inv.shareToken })).result, 'not_eligible');
  });

  it('invalid tokens and codes resolve to "invalid" (no detail leaked)', async () => {
    const visitor = newDevice();
    assert.equal((await visitor.repo.previewInvitation({ token: 'A'.repeat(43) })).result, 'invalid');
    const probe = await visitor.repo.previewInvitation({ code: 'AF-2345-6789' });
    assert.ok(probe.result === 'invalid' || probe.result === 'rate_limited');
    assert.equal(probe.inviterName, null);
  });
});

describe('Reception check-in: guest scans the station QR (integration)', { skip }, () => {
  /** Station created like Arena Fit would (service role); returns the printed QR payload. */
  async function station(name: string, active = true) {
    const svc = admin();
    const { data, error } = await svc.rpc('create_reception_station', { p_name: name });
    assert.equal(error, null);
    const st = data as { station_id: string; qr_payload: string };
    if (!active) assert.equal((await svc.rpc('set_reception_station_active', { p_station_id: st.station_id, p_active: false })).error, null);
    return { ...st, name };
  }

  /** A guest holding an activated pass. */
  async function guestWithPass() {
    const member = await newMember('Hôte');
    const inv = await member.repo.createInvitation(null);
    const g = await guest();
    assert.equal((await g.repo.activateInvitation({ token: inv.shareToken })).result, 'activated');
    return { ...g, inv };
  }

  it('valid guest + valid reception QR → redeemed once; scanning again → already used with the time', async () => {
    const st = await station(`Réception ${randomUUID().slice(0, 6)}`);
    const g = await guestWithPass();
    const first = await g.repo.redeemMyGuestPass(st.qr_payload);
    assert.equal(first.result, 'redeemed');
    const again = await g.repo.redeemMyGuestPass(st.qr_payload);
    assert.equal(again.result, 'already_used');
    assert.ok(first.result === 'redeemed' && again.result === 'already_used' && again.redeemedAt === first.redeemedAt);
    const pass = await g.repo.getMyGuestPass();
    assert.equal(pass?.status, 'used');
    assert.equal(pass?.redeemedAt, first.result === 'redeemed' ? first.redeemedAt : null);
  });

  it('two simultaneous scans by the same guest use the pass ONCE', async () => {
    const st = await station(`Réception ${randomUUID().slice(0, 6)}`);
    const g = await guestWithPass();
    const results = await Promise.all(Array.from({ length: 4 }, () => g.repo.redeemMyGuestPass(st.qr_payload)));
    assert.deepEqual(results.map((r) => r.result).sort(), ['already_used', 'already_used', 'already_used', 'redeemed']);
    const { count } = await admin().from('guest_redemptions').select('id', { count: 'exact', head: true }).eq('guest_profile_id', g.user.id);
    assert.equal(count, 1);
  });

  it('refuses: no pass, expired pass, invalid / inactive / malformed / URL QR, members and visitors', async () => {
    const st = await station(`Réception ${randomUUID().slice(0, 6)}`);
    const off = await station(`Réception fermée ${randomUUID().slice(0, 6)}`, false);

    const noPass = await guest();
    assert.equal((await noPass.repo.redeemMyGuestPass(st.qr_payload)).result, 'no_pass');

    const g = await guestWithPass();
    for (const bad of ['hello', 'https://example.com/promo', `AFR1.${'A'.repeat(43)}`, `http://localhost/invite/${g.inv.shareToken}`]) {
      assert.equal((await g.repo.redeemMyGuestPass(bad)).result, 'invalid_qr', bad);
    }
    assert.equal((await g.repo.redeemMyGuestPass(off.qr_payload)).result, 'station_inactive');
    assert.equal((await g.repo.getMyGuestPass())?.status, 'activated', 'refused scans leave the pass unused');

    const expiring = await guestWithPass();
    await admin().from('guest_invitations').update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', expiring.inv.invitationId);
    assert.equal((await expiring.repo.redeemMyGuestPass(st.qr_payload)).result, 'expired');

    const member = await newMember('Membre');
    assert.equal((await member.repo.redeemMyGuestPass(st.qr_payload)).result, 'not_guest');

    const anon = createPublicClient(url!, anonKey!);
    assert.equal((await anon.rpc('redeem_my_guest_pass', { p_reception_qr: st.qr_payload })).error?.code, '42501');
  });

  it('a guest cannot redeem another guest’s pass (identity comes from the session only)', async () => {
    const st = await station(`Réception ${randomUUID().slice(0, 6)}`);
    const owner = await guestWithPass();
    const other = await guest();
    // There is no parameter to name a pass or a guest: the other guest only ever reaches their own (none).
    assert.equal((await other.repo.redeemMyGuestPass(st.qr_payload)).result, 'no_pass');
    assert.equal((await owner.repo.getMyGuestPass())?.status, 'activated');
  });

  it('station tokens: hash only, unreadable through the API, rotation revokes the old QR', async () => {
    const st = await station(`Réception ${randomUUID().slice(0, 6)}`);
    const g = await guestWithPass();
    assert.equal((await g.client.from('reception_stations').select('token_hash')).error?.code, '42501');
    assert.equal((await createPublicClient(url!, anonKey!).from('reception_stations').select('*')).error?.code, '42501');
    assert.ok((await g.client.rpc('rotate_reception_station_token', { p_station_id: st.station_id })).error, 'apps cannot rotate');

    const { data: row } = await admin().from('reception_stations').select('token_hash').eq('id', st.station_id).single();
    assert.notEqual(row!.token_hash, `\\x${Buffer.from(st.qr_payload.slice(5)).toString('hex')}`, 'raw token not stored');

    const rotated = (await admin().rpc('rotate_reception_station_token', { p_station_id: st.station_id })).data as { qr_payload: string };
    assert.notEqual(rotated.qr_payload, st.qr_payload);
    assert.equal((await g.repo.redeemMyGuestPass(st.qr_payload)).result, 'invalid_qr', 'old QR rejected after rotation');
    assert.equal((await g.repo.redeemMyGuestPass(rotated.qr_payload)).result, 'redeemed', 'new QR works after rotation');
  });

  it('server time: 120 s confirmation window, server clock offset, safe history only', async () => {
    const st = await station(`Réception ${randomUUID().slice(0, 6)}`);
    const g = await guestWithPass();
    const r = await g.repo.redeemMyGuestPass(st.qr_payload);
    assert.ok(r.result === 'redeemed');
    assert.equal(Date.parse(r.confirmationUntil) - Date.parse(r.redeemedAt), 120_000);
    assert.ok(Math.abs(r.clockOffsetMs) < 5_000, 'local server and test runner share a clock');

    const pass = await g.repo.getMyGuestPass();
    assert.equal(pass?.status, 'used');
    assert.equal(pass?.redeemedAt, r.redeemedAt);
    assert.equal(pass?.stationName, st.name);
    assert.equal(pass?.confirmationUntil, r.confirmationUntil);

    const { data } = await g.client.rpc('get_my_guest_pass');
    assert.deepEqual(Object.keys(data as object).sort(), [
      'activated_at', 'confirmation_until', 'inviter_name', 'reception_station_name', 'redeemed_at', 'server_now',
      'sessions', 'status', 'valid_until',
    ]);
    assert.ok(!JSON.stringify(data).includes(st.qr_payload.slice(5)), 'no station token');
  });

  it('a retry after a lost response never redeems twice', async () => {
    const st = await station(`Réception ${randomUUID().slice(0, 6)}`);
    const g = await guestWithPass();
    // First request reaches the server but the app never sees the answer…
    await g.client.rpc('redeem_my_guest_pass', { p_reception_qr: st.qr_payload });
    // …so the guest taps « Réessayer » with the same payload.
    const retry = await g.repo.redeemMyGuestPass(st.qr_payload);
    assert.equal(retry.result, 'already_used');
    assert.ok(retry.result === 'already_used' && retry.confirmationUntil, 'the retry still knows the confirmation window');
    const { count } = await admin().from('guest_redemptions').select('id', { count: 'exact', head: true }).eq('guest_profile_id', g.user.id);
    assert.equal(count, 1);
  });

  it('rotation keeps the station identity and history; deactivate / reactivate', async () => {
    const svc = admin();
    const st = await station(`Réception ${randomUUID().slice(0, 6)}`);
    const before = await guestWithPass();
    const waiting = await guestWithPass(); // pass activated before the rotation
    assert.equal((await before.repo.redeemMyGuestPass(st.qr_payload)).result, 'redeemed');

    const rotated = (await svc.rpc('rotate_reception_station_token', { p_station_id: st.station_id })).data as {
      station_id: string;
      qr_payload: string;
    };
    assert.equal(rotated.station_id, st.station_id, 'same station after rotation');
    assert.equal((await waiting.repo.redeemMyGuestPass(st.qr_payload)).result, 'invalid_qr', 'old QR stops working');
    assert.equal((await waiting.repo.getMyGuestPass())?.status, 'activated', 'existing passes unaffected');

    assert.equal((await svc.rpc('deactivate_reception_station', { p_station_id: st.station_id })).error, null);
    assert.equal((await waiting.repo.redeemMyGuestPass(rotated.qr_payload)).result, 'station_inactive');
    assert.equal((await svc.rpc('reactivate_reception_station', { p_station_id: st.station_id })).error, null);
    assert.equal((await waiting.repo.redeemMyGuestPass(rotated.qr_payload)).result, 'redeemed', 'new QR works');

    const { data: rows } = await svc.from('guest_redemptions').select('reception_station_id').in('guest_profile_id', [before.user.id, waiting.user.id]);
    assert.deepEqual(rows!.map((r) => r.reception_station_id), [st.station_id, st.station_id], 'history on one station');
    const { data: outcomes } = await svc
      .from('guest_pass_events')
      .select('outcome')
      .eq('reception_station_id', st.station_id)
      .eq('event', 'reception_qr_scanned');
    assert.deepEqual(outcomes!.map((o) => o.outcome).sort(), ['inactive_station', 'success', 'success']);
    assert.ok((await waiting.client.rpc('deactivate_reception_station', { p_station_id: st.station_id })).error, 'apps cannot deactivate');
  });
});

