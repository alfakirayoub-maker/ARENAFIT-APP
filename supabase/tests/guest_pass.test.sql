-- Guest Pass flow: creation, preview, activation, cancellation, expiry,
-- secrets and access control. Concurrency (parallel taps / activations) is
-- exercised against the real API in apps/mobile/tests/guest-pass.integration.test.mts.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(96);

-- ---------------------------------------------------------------------------
-- People (as table owner)
-- ---------------------------------------------------------------------------
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000b1'),  -- member Ayoub
  ('00000000-0000-0000-0000-0000000000b2'),  -- another member
  ('00000000-0000-0000-0000-0000000000b3'),  -- member profile without an active membership
  ('00000000-0000-0000-0000-0000000000c1'),  -- guest identity 1
  ('00000000-0000-0000-0000-0000000000c2'),  -- guest identity 2
  ('00000000-0000-0000-0000-0000000000c3');  -- guest identity 3 (pass expires)
update profiles set kind = 'member' where id in (
  '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b3');
update profiles set first_name = 'Ayoub' where id = '00000000-0000-0000-0000-0000000000b1';
update profiles set first_name = 'Karim', show_name_on_invitations = false where id = '00000000-0000-0000-0000-0000000000b2';
insert into memberships (profile_id, plan_name, membership_type, starts_on) values
  ('00000000-0000-0000-0000-0000000000b1', 'Test plan', 'test', current_date - 30),
  ('00000000-0000-0000-0000-0000000000b2', 'Test plan', 'test', current_date - 30);
insert into memberships (profile_id, plan_name, membership_type, starts_on, ends_on) values
  ('00000000-0000-0000-0000-0000000000b3', 'Old plan', 'test', current_date - 400, current_date - 35);

-- Raw values returned by the RPCs, kept for later steps.
create temp table t (k text primary key, v jsonb);
grant all on t to anon, authenticated, service_role;

create function pg_temp.as_user(p_id text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', p_id)::text, true),
         set_config('request.headers', '{}', true)
$$;
create function pg_temp.as_anon(p_ip text default '203.0.113.7') returns void language sql as $$
  select set_config('role', 'anon', true),
         set_config('request.jwt.claims', '{"role":"anon"}', true),
         set_config('request.headers', json_build_object('x-forwarded-for', p_ip)::text, true)
$$;
create function pg_temp.v(p_k text) returns jsonb language sql as $$ select v from t where k = p_k $$;
grant execute on function pg_temp.v(text) to public;

-- ---------------------------------------------------------------------------
-- Creation: atomic reservation, raw secrets returned once
-- ---------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');

select is((get_my_guest_invitations() ->> 'available')::int, 3, 'a new member starts with 3 passes (setting)');
insert into t values ('i1', create_guest_invitation('Yassine'));
select is((pg_temp.v('i1') ->> 'available')::int, 2, 'creating an invitation with 3 passes leaves 2');
select matches(pg_temp.v('i1') ->> 'short_code', '^AF-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$', 'short code format AF-XXXX-XXXX');
select ok(char_length(pg_temp.v('i1') ->> 'share_token') >= 43, 'share token carries 256 bits');
select ok((pg_temp.v('i1') ->> 'share_token') <> (pg_temp.v('i1') ->> 'invitation_id'), 'the share token is not the row id');
select is(((pg_temp.v('i1') ->> 'expires_at')::timestamptz - now()), interval '15 days', 'valid for 15 days (setting)');
insert into t values ('i2', create_guest_invitation('Sara'));
insert into t values ('i3', create_guest_invitation(null));
select is((pg_temp.v('i3') ->> 'available')::int, 0, 'three invitations use the whole balance');
select throws_ok($$ select create_guest_invitation('Mehdi') $$, 'P0001', 'gp_no_pass_available',
  'a fourth invitation is refused: the balance never goes negative');
select throws_ok($$ select create_guest_invitation(repeat('x', 61)) $$, 'P0001', 'gp_invalid_name', 'invitee name is bounded');
select throws_ok($$ insert into guest_invitations (inviter_id, link_token_hash, short_code_hash, expires_at)
  values (auth.uid(), '\x00', '\x00', now()) $$, '42501', null, 'members cannot write invitations directly');
select throws_ok($$ update guest_pass_balances set allowance = 99 $$, '42501', null, 'members cannot change their balance');
select throws_ok($$ select link_token_hash from guest_invitations $$, '42501', null, 'token hashes are not readable through the API');
select is((select count(*) from guest_invitations)::int, 3, 'a member reads their own invitations');
select is(jsonb_array_length(get_my_guest_invitations() -> 'invitations'), 3, 'overview lists the 3 invitations');

reset role;
select is((select count(*) from guest_invitations
  where link_token_hash = convert_to(pg_temp.v('i1') ->> 'share_token', 'UTF8')
     or short_code_hash = convert_to(pg_temp.v('i1') ->> 'short_code', 'UTF8'))::int, 0,
  'raw share token and short code are never stored');
select is((select link_token_hash from guest_invitations where id = (pg_temp.v('i1') ->> 'invitation_id')::uuid),
  digest(pg_temp.v('i1') ->> 'share_token', 'sha256'), 'only the SHA-256 of the share token is stored');
select is((select count(*) from guest_pass_events where event = 'gift_created')::int, 3, 'gift_created recorded per invitation');

-- Eligibility
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select throws_ok($$ select create_guest_invitation('x') $$, 'P0001', 'gp_not_eligible', 'no active membership → cannot offer');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select create_guest_invitation('x') $$, 'P0001', 'gp_not_eligible', 'a guest cannot offer passes');
select throws_ok($$ select get_my_guest_invitations() $$, 'P0001', 'gp_not_eligible', 'a guest has no invitations overview');

-- ---------------------------------------------------------------------------
-- Preview (public, by secret only)
-- ---------------------------------------------------------------------------
select pg_temp.as_anon();
select throws_ok($$ select 1 from guest_invitations $$, '42501', null, 'public visitors cannot list invitations');
select is(preview_guest_invitation(pg_temp.v('i1') ->> 'share_token', null) ->> 'result', 'valid', 'preview by share token');
select is(preview_guest_invitation(pg_temp.v('i1') ->> 'share_token', null) ->> 'inviter_name', 'Ayoub', 'preview shows the inviter first name');
select is(preview_guest_invitation(pg_temp.v('i1') ->> 'share_token', null) ->> 'sessions', '1', 'preview: 1 séance offerte');
select ok(not (preview_guest_invitation(pg_temp.v('i1') ->> 'share_token', null) ?| array['id', 'invitation_id', 'inviter_id', 'invitee_name']),
  'preview exposes no ids or invitee data');
select is(preview_guest_invitation(lower(replace(pg_temp.v('i2') ->> 'short_code', '-', ' ')), null) ->> 'result', 'invalid',
  'a code is not accepted as a token');
select is(preview_guest_invitation(null, lower(replace(pg_temp.v('i2') ->> 'short_code', '-', ' '))) ->> 'result', 'valid',
  'short code is case/separator-insensitive');
select is(preview_guest_invitation('not-a-token', null) ->> 'result', 'invalid', 'unknown token → invalid');
select is(preview_guest_invitation(pg_temp.v('i1') ->> 'invitation_id', null) ->> 'result', 'invalid', 'knowing the id grants nothing');
select is(preview_guest_invitation(null, null) ->> 'result', 'invalid', 'empty request → invalid');
select throws_ok($$ select activate_guest_invitation(pg_temp.v('i1') ->> 'share_token', null) $$, '42501', null,
  'activation requires a guest identity');

-- ---------------------------------------------------------------------------
-- Activation: atomic, idempotent, one pass per invitation
-- ---------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into t values ('a1', activate_guest_invitation(pg_temp.v('i1') ->> 'share_token', null));
select is(pg_temp.v('a1') ->> 'result', 'activated', 'guest activates the invitation');
select ok(not (pg_temp.v('a1') ? 'qr_token'), 'activation hands out no guest QR secret');
select is(pg_temp.v('a1') #>> '{pass,status}', 'activated', 'the guest pass is returned with the activation');
select is(activate_guest_invitation(pg_temp.v('i1') ->> 'share_token', null) ->> 'result', 'already_active',
  'same guest opening the link again gets the existing pass');
select is(activate_guest_invitation(null, pg_temp.v('i1') ->> 'short_code') ->> 'result', 'already_active',
  'the fallback code resolves the same invitation');
select is(preview_guest_invitation(pg_temp.v('i1') ->> 'share_token', null) ->> 'result', 'yours', 'preview recognises the owner');
select is(get_my_guest_pass() ->> 'status', 'activated', 'guest reads their current pass');
select is(get_my_guest_pass() ->> 'inviter_name', 'Ayoub', 'pass shows who offered it');
select is((select count(*) from guest_passes)::int, 1, 'guest sees their own pass row');
select is(activate_guest_invitation(pg_temp.v('i2') ->> 'share_token', null) ->> 'result', 'has_active_pass',
  'one active pass per guest identity');

reset role;
select is((select count(*) from guest_passes where invitation_id = (pg_temp.v('i1') ->> 'invitation_id')::uuid)::int, 1,
  'repeated activations created exactly one pass');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select is(activate_guest_invitation(pg_temp.v('i1') ->> 'share_token', null) ->> 'result', 'already_claimed',
  'another guest cannot claim an activated invitation');
select is(activate_guest_invitation(null, pg_temp.v('i1') ->> 'short_code') ->> 'result', 'already_claimed',
  '…not with the code either');
select is((select count(*) from guest_passes)::int, 0, 'a guest cannot see another guest''s pass');
select is((select count(*) from guest_invitations)::int, 0, 'a guest cannot see other invitations');
select ok(get_my_guest_pass() is null, 'no pass for a guest who activated nothing');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select is(activate_guest_invitation(pg_temp.v('i2') ->> 'share_token', null) ->> 'result', 'not_eligible', 'members do not activate guest passes');
select is((select count(*) from guest_invitations)::int, 0, 'a member cannot see another member''s invitations');
select throws_ok(format('select cancel_guest_invitation(%L)', pg_temp.v('i2') ->> 'invitation_id'), 'P0001', 'gp_not_found',
  'a member cannot cancel another member''s invitation');

-- ---------------------------------------------------------------------------
-- Cancellation
-- ---------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select throws_ok(format('select cancel_guest_invitation(%L)', pg_temp.v('i1') ->> 'invitation_id'), 'P0001', 'gp_not_cancellable',
  'an activated invitation cannot be cancelled');
select is((cancel_guest_invitation((pg_temp.v('i2') ->> 'invitation_id')::uuid) ->> 'available')::int, 1,
  'cancelling before activation returns the pass');
select throws_ok(format('select cancel_guest_invitation(%L)', pg_temp.v('i2') ->> 'invitation_id'), 'P0001', 'gp_not_cancellable',
  'cancelling twice is refused (no double refund)');
select pg_temp.as_anon();
select is(preview_guest_invitation(pg_temp.v('i2') ->> 'share_token', null) ->> 'result', 'cancelled', 'cancelled invitation preview');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select is(activate_guest_invitation(pg_temp.v('i2') ->> 'share_token', null) ->> 'result', 'cancelled', 'cancelled invitation cannot be activated');

-- ---------------------------------------------------------------------------
-- Re-share rotates the link; expiry returns the pass exactly once
-- ---------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into t values ('r3', reshare_guest_invitation((pg_temp.v('i3') ->> 'invitation_id')::uuid));
select pg_temp.as_anon();
select is(preview_guest_invitation(pg_temp.v('i3') ->> 'share_token', null) ->> 'result', 'invalid', 're-share revokes the previous link');
select is(preview_guest_invitation(pg_temp.v('r3') ->> 'share_token', null) ->> 'result', 'valid', '…and the new link works');

reset role;
update guest_invitations set expires_at = now() - interval '1 minute' where id = (pg_temp.v('i3') ->> 'invitation_id')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select expire_guest_invitations() $$, '42501', null, 'the expiry job is not callable from the apps');
reset role;
set local role service_role;
select is(expire_guest_invitations(), 1, 'the scheduled job expires the overdue invitation');
select is(expire_guest_invitations(), 0, 're-running the job changes nothing');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select is((get_my_guest_invitations() ->> 'available')::int, 2, 'expired unused invitation returned its pass once');
select pg_temp.as_anon();
select is(preview_guest_invitation(pg_temp.v('r3') ->> 'share_token', null) ->> 'result', 'expired', 'expired invitation preview');

-- ---------------------------------------------------------------------------
-- Short-code brute force is rate limited per client
-- ---------------------------------------------------------------------------
select pg_temp.as_anon('198.51.100.9');
select is((select count(*) from generate_series(1, 10) n
  where preview_guest_invitation(null, 'AF-2222-' || lpad(n::text, 4, '2')) ->> 'result' = 'invalid')::int, 10,
  'wrong codes are reported as invalid');
select is(preview_guest_invitation(null, pg_temp.v('i1') ->> 'short_code') ->> 'result', 'rate_limited',
  'after 10 failures the client is blocked, even with a real code');
select pg_temp.as_anon('198.51.100.10');
select isnt(preview_guest_invitation(null, pg_temp.v('i1') ->> 'short_code') ->> 'result', 'rate_limited',
  'other clients are not affected');

-- ---------------------------------------------------------------------------
-- Reception check-in: the guest scans the station QR with their phone
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;
insert into t values ('st', create_reception_station('Réception principale'));
insert into t values ('st2', create_reception_station('Réception test'));
select set_reception_station_active((pg_temp.v('st2') ->> 'station_id')::uuid, false);
reset role;
select matches(pg_temp.v('st') ->> 'qr_payload', '^AFR1\.[A-Za-z0-9_-]{43}$', 'station QR payload is AFR1.<256-bit token>');
select is((select token_hash from reception_stations where name = 'Réception principale'),
  digest(substr(pg_temp.v('st') ->> 'qr_payload', 6), 'sha256'), 'only the station token hash is stored');
select is((select count(*) from reception_stations
  where token_hash = convert_to(pg_temp.v('st') ->> 'qr_payload', 'UTF8')
     or token_hash = convert_to(substr(pg_temp.v('st') ->> 'qr_payload', 6), 'UTF8'))::int, 0, 'raw station token is never stored');

-- A second guest with a pass that expires before the visit.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
insert into t values ('i4', create_guest_invitation(null));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
select is(activate_guest_invitation(pg_temp.v('i4') ->> 'share_token', null) ->> 'result', 'activated', 'third guest activates');
reset role;
update guest_invitations set expires_at = now() - interval '1 minute' where id = (pg_temp.v('i4') ->> 'invitation_id')::uuid;

select pg_temp.as_anon();
select throws_ok(format('select redeem_my_guest_pass(%L)', pg_temp.v('st') ->> 'qr_payload'), '42501', null,
  'public visitors cannot redeem');
select throws_ok($$ select 1 from reception_stations $$, '42501', null, 'public visitors cannot read stations');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select is(redeem_my_guest_pass(pg_temp.v('st') ->> 'qr_payload') ->> 'result', 'not_guest', 'members cannot redeem guest passes');
select throws_ok($$ select token_hash from reception_stations $$, '42501', null, 'station hashes are not readable through the API');
select throws_ok($$ select create_reception_station('Fake') $$, '42501', null, 'apps cannot create stations');
select throws_ok(format('select rotate_reception_station_token(%L)', pg_temp.v('st') ->> 'station_id'), '42501', null,
  'apps cannot rotate station tokens');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select is(redeem_my_guest_pass(pg_temp.v('st') ->> 'qr_payload') ->> 'result', 'no_pass',
  'a guest without an active pass is refused (and cannot use another guest''s pass)');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select is(redeem_my_guest_pass('hello') ->> 'result', 'invalid_qr', 'malformed QR rejected');
select is(redeem_my_guest_pass('https://arenafit.example/checkin') ->> 'result', 'invalid_qr', 'arbitrary URL rejected');
select is(redeem_my_guest_pass('http://localhost/invite/' || (pg_temp.v('i1') ->> 'share_token')) ->> 'result', 'invalid_qr',
  'invitation link rejected');
select is(redeem_my_guest_pass('AFR1.' || (pg_temp.v('i1') ->> 'share_token')) ->> 'result', 'invalid_qr',
  'well-formed but unknown station token rejected');
select is(redeem_my_guest_pass(pg_temp.v('st2') ->> 'qr_payload') ->> 'result', 'station_inactive', 'inactive station rejected');
select is(get_my_guest_pass() ->> 'status', 'activated', '…and the pass is still unused');

insert into t values ('red', redeem_my_guest_pass(pg_temp.v('st') ->> 'qr_payload'));
select is(pg_temp.v('red') ->> 'result', 'redeemed', 'valid guest + valid station QR → redeemed');
select is(pg_temp.v('red') ->> 'reception_station_name', 'Réception principale', 'success shows the station');
insert into t values ('red2', redeem_my_guest_pass(pg_temp.v('st') ->> 'qr_payload'));
select is(pg_temp.v('red2') ->> 'result', 'already_used', 'scanning again → already used');
select is(pg_temp.v('red2') ->> 'redeemed_at', pg_temp.v('red') ->> 'redeemed_at', '…with the original redemption time');
select is(get_my_guest_pass() ->> 'status', 'used', 'the pass is now used');
select ok(get_my_guest_pass() ->> 'redeemed_at' is not null, 'the pass carries its redemption time');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
select is(redeem_my_guest_pass(pg_temp.v('st') ->> 'qr_payload') ->> 'result', 'expired', 'expired pass rejected');

reset role;
select is((select count(*) from guest_redemptions)::int, 1, 'exactly one redemption recorded');
select is((select reception_station_id from guest_redemptions), (pg_temp.v('st') ->> 'station_id')::uuid,
  'the redemption records the station');

-- Rotation
set local role service_role;
insert into t values ('st_new', rotate_reception_station_token((pg_temp.v('st') ->> 'station_id')::uuid));
reset role;
select isnt(pg_temp.v('st_new') ->> 'qr_payload', pg_temp.v('st') ->> 'qr_payload', 'rotation issues a new QR');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select is(redeem_my_guest_pass(pg_temp.v('st') ->> 'qr_payload') ->> 'result', 'invalid_qr', 'old station QR rejected after rotation');
select is(redeem_my_guest_pass(pg_temp.v('st_new') ->> 'qr_payload') ->> 'result', 'no_pass',
  'new station QR accepted after rotation (station check passes)');

-- Funnel
reset role;
select results_eq($$ select event, count(*)::int from guest_pass_events
  where event in ('gift_created', 'gift_activated', 'gift_cancelled', 'gift_expired', 'guest_pass_redeemed')
  group by event order by event $$,
  $$ values ('gift_activated', 2), ('gift_cancelled', 1), ('gift_created', 4), ('gift_expired', 2), ('guest_pass_redeemed', 1) $$,
  'funnel events recorded once per transition');
select ok((select count(*) from guest_pass_events where event = 'reception_qr_scanned') >= 4, 'reception scans are recorded');

select * from finish();
rollback;
