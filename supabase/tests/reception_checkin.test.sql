-- Reception check-in hardening: confirmation window from server time, safe
-- pass history, scan outcomes, station deactivate/reactivate/rotate.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(27);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000b1'),  -- member
  ('00000000-0000-0000-0000-0000000000c1'),  -- guest who visits before rotation
  ('00000000-0000-0000-0000-0000000000c2');  -- guest who visits after rotation
update profiles set kind = 'member', first_name = 'Ayoub' where id = '00000000-0000-0000-0000-0000000000b1';
insert into memberships (profile_id, plan_name, membership_type, starts_on)
  values ('00000000-0000-0000-0000-0000000000b1', 'Test plan', 'test', current_date - 30);

create temp table t (k text primary key, v jsonb);
grant all on t to anon, authenticated, service_role;
create function pg_temp.as_user(p_id text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', p_id)::text, true),
         set_config('request.headers', '{}', true)
$$;
create function pg_temp.v(p_k text) returns jsonb language sql as $$ select v from t where k = p_k $$;
grant execute on function pg_temp.v(text) to public;

-- Station + two activated passes
set local role service_role;
insert into t values ('st', create_reception_station('Réception principale'));
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into t values ('i1', create_guest_invitation('Sara'));
insert into t values ('i2', create_guest_invitation('Nora'));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select activate_guest_invitation(pg_temp.v('i1') ->> 'share_token', null);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select activate_guest_invitation(pg_temp.v('i2') ->> 'share_token', null);

-- ---------------------------------------------------------------------------
-- Server time and confirmation window
-- ---------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select ok(get_my_guest_pass() ? 'server_now', 'pass state carries the server clock');
select ok(get_my_guest_pass() -> 'confirmation_until' = 'null'::jsonb, 'no confirmation window before redemption');

insert into t values ('red', redeem_my_guest_pass(pg_temp.v('st') ->> 'qr_payload'));
select is(pg_temp.v('red') ->> 'result', 'redeemed', 'redeemed');
select ok((pg_temp.v('red') ->> 'server_now')::timestamptz >= (pg_temp.v('red') ->> 'redeemed_at')::timestamptz,
  'success carries the server time');
select is((pg_temp.v('red') ->> 'confirmation_until')::timestamptz - (pg_temp.v('red') ->> 'redeemed_at')::timestamptz,
  interval '120 seconds', 'live confirmation window = 120 s by default (setting)');
select is(pg_temp.v('red') ->> 'reception_station_name', 'Réception principale', 'success names the station');

insert into t values ('again', redeem_my_guest_pass(pg_temp.v('st') ->> 'qr_payload'));
select is(pg_temp.v('again') ->> 'result', 'already_used', 'a second scan is "already used"');
select is(pg_temp.v('again') ->> 'confirmation_until', pg_temp.v('red') ->> 'confirmation_until',
  '…with the same window: a re-scan never opens a new one');

-- Safe history for the app (re-open / restart)
insert into t values ('hist', get_my_guest_pass());
select is(pg_temp.v('hist') ->> 'status', 'used', 'history: used');
select is(pg_temp.v('hist') ->> 'redeemed_at', pg_temp.v('red') ->> 'redeemed_at', 'history: server redemption time');
select is(pg_temp.v('hist') ->> 'reception_station_name', 'Réception principale', 'history: station name');
select is(pg_temp.v('hist') ->> 'confirmation_until', pg_temp.v('red') ->> 'confirmation_until', 'history: same window end');
select is((select array_agg(k order by k) from jsonb_object_keys(pg_temp.v('hist')) k) collate "C",
  array['activated_at', 'confirmation_until', 'inviter_name', 'reception_station_name', 'redeemed_at', 'server_now',
        'sessions', 'status', 'valid_until'],
  'history exposes presentation fields only (no ids, hashes or tokens)');

reset role;
update app_settings set value = '30' where key = 'guest_pass.checkin_confirmation_seconds';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select is((get_my_guest_pass() ->> 'confirmation_until')::timestamptz - (pg_temp.v('red') ->> 'redeemed_at')::timestamptz,
  interval '30 seconds', 'the window is configurable');
reset role;
update app_settings set value = '120' where key = 'guest_pass.checkin_confirmation_seconds';

-- ---------------------------------------------------------------------------
-- Station lifecycle: deactivate / reactivate / rotate keep the same station
-- ---------------------------------------------------------------------------
set local role service_role;
select deactivate_reception_station((pg_temp.v('st') ->> 'station_id')::uuid);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select is(redeem_my_guest_pass(pg_temp.v('st') ->> 'qr_payload') ->> 'result', 'station_inactive', 'deactivated station refused');
select is(get_my_guest_pass() ->> 'status', 'activated', '…and the pass is untouched');

set local role service_role;
select reactivate_reception_station((pg_temp.v('st') ->> 'station_id')::uuid);
insert into t values ('rot', rotate_reception_station_token((pg_temp.v('st') ->> 'station_id')::uuid));
reset role;
select is(pg_temp.v('rot') ->> 'station_id', pg_temp.v('st') ->> 'station_id', 'rotation keeps the station identity');
select is((select count(*) from reception_stations)::int, 1, 'rotation creates no new reception');
select ok((select last_rotated_at is not null from reception_stations), 'rotation is timestamped');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select is(redeem_my_guest_pass(pg_temp.v('st') ->> 'qr_payload') ->> 'result', 'invalid_qr', 'old token rejected after rotation');
select is(get_my_guest_pass() ->> 'status', 'activated', 'existing guest passes are unaffected by rotation');
select is(redeem_my_guest_pass(pg_temp.v('rot') ->> 'qr_payload') ->> 'result', 'redeemed', 'new token accepted');

reset role;
select is((select count(distinct reception_station_id)::int from guest_redemptions), 1,
  'redemptions before and after rotation belong to the same station');

-- ---------------------------------------------------------------------------
-- Analytics outcomes (no payloads stored)
-- ---------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select redeem_my_guest_pass('not-a-qr');
reset role;
select results_eq(
  $$ select outcome, count(*)::int from guest_pass_events where event = 'reception_qr_scanned' group by outcome order by outcome $$,
  $$ values ('already_used', 1), ('inactive_station', 1), ('invalid_format', 1), ('invalid_station', 1), ('success', 2) $$,
  'every server-side scan is recorded with its outcome');
select is((select count(*)::int from guest_pass_events where event = 'guest_pass_redeemed'), 2, 'one redeemed event per redemption');
select is((select count(distinct reception_station_id)::int from guest_pass_events where reception_station_id is not null), 1,
  'station analytics stay on one station across rotation');
select hasnt_column('guest_pass_events', 'payload', 'events store no scanned payload');

select * from finish();
rollback;
