-- =============================================================================
-- Reception check-in hardening (Sprint 6)
--
--  * Live confirmation window: after a redemption the app may show the large
--    « PASS VALIDÉ » state only until redeemed_at + guest_pass.checkin_confirmation_seconds
--    (default 120 s). Every response carries the server's clock (server_now)
--    and the window end (confirmation_until), so freshness never depends on
--    the device clock.
--  * Scan outcomes are recorded for analytics (no payloads, no secrets).
--  * Explicit station operations: create, deactivate, reactivate, rotate.
-- =============================================================================

insert into public.app_settings (key, value, is_public, description) values
  ('guest_pass.checkin_confirmation_seconds', '120', false,
   'How long the app shows the live « PASS VALIDÉ » confirmation after a redemption')
on conflict (key) do nothing;

-- One reception_qr_scanned event per server-side attempt, with its outcome.
-- network_error is client-side by nature (the request never arrived) and is
-- not recorded here.
alter table public.guest_pass_events
  add column outcome text check (outcome in (
    'success', 'invalid_format', 'invalid_station', 'inactive_station', 'no_pass', 'expired', 'already_used'
  ));
create index guest_pass_events_station_idx on public.guest_pass_events (reception_station_id, created_at)
  where reception_station_id is not null;

drop function private.log_event(uuid, text, uuid);
create function private.log_event(p_invitation uuid, p_event text, p_station uuid default null, p_outcome text default null)
returns void language sql volatile set search_path = '' as $$
  insert into public.guest_pass_events (invitation_id, event, actor_id, reception_station_id, outcome)
  values (p_invitation, p_event, auth.uid(), p_station, p_outcome);
$$;

create or replace function private.confirmation_until(p_redeemed_at timestamptz)
returns timestamptz language sql stable set search_path = '' as $$
  select p_redeemed_at + make_interval(secs => greatest(private.setting_int('guest_pass.checkin_confirmation_seconds', 120), 0))
$$;

-- Safe presentation data of the caller's pass: status, dates, station NAME.
-- Never ids of other rows, token hashes or secrets. server_now lets the app
-- align its clock; confirmation_until (used passes) bounds the live state.
create or replace function public.get_my_guest_pass()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then return null; end if;
  perform private.expire_due(null, uid);
  select jsonb_build_object(
    'status', i.status,
    'inviter_name', private.inviter_display_name(i.inviter_id),
    'sessions', p.sessions_allowed,
    'valid_until', p.valid_until,
    'activated_at', i.activated_at,
    'redeemed_at', r.redeemed_at,
    'reception_station_name', st.name,
    'confirmation_until', case when r.redeemed_at is not null then private.confirmation_until(r.redeemed_at) end,
    'server_now', clock_timestamp()
  ) into result
  from public.guest_passes p
  join public.guest_invitations i on i.id = p.invitation_id
  left join public.guest_redemptions r on r.guest_pass_id = p.id
  left join public.reception_stations st on st.id = r.reception_station_id
  where p.guest_profile_id = uid
  order by (i.status = 'activated') desc, p.created_at desc
  limit 1;
  return result;
end;
$$;

-- Same flow as Sprint 5 (one transaction, guest from the session, profile
-- lock against concurrent scans, unique redemption per pass), plus server
-- timestamps in every result and an outcome on every recorded scan.
--   result: redeemed | already_used | expired | no_pass | invalid_qr |
--           station_inactive | not_guest
create or replace function public.redeem_my_guest_pass(p_reception_qr text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  station public.reception_stations;
  inv public.guest_invitations;
  inv_id uuid;
  pass_id uuid;
  red public.guest_redemptions;
  prev record;
begin
  if uid is null or coalesce((select kind::text from public.profiles where id = uid), '') <> 'guest' then
    return jsonb_build_object('result', 'not_guest', 'server_now', clock_timestamp());
  end if;
  perform 1 from public.profiles where id = uid for update;

  if p_reception_qr is null or p_reception_qr !~ '^AFR1\.[A-Za-z0-9_-]{43}$' then
    perform private.log_event(null, 'reception_qr_scanned', null, 'invalid_format');
    return jsonb_build_object('result', 'invalid_qr', 'server_now', clock_timestamp());
  end if;
  select * into station from public.reception_stations
  where token_hash = private.sha256(substr(p_reception_qr, 6));
  if not found then
    perform private.log_event(null, 'reception_qr_scanned', null, 'invalid_station');
    return jsonb_build_object('result', 'invalid_qr', 'server_now', clock_timestamp());
  end if;
  if not station.active then
    perform private.log_event(null, 'reception_qr_scanned', station.id, 'inactive_station');
    return jsonb_build_object('result', 'station_inactive', 'server_now', clock_timestamp());
  end if;

  select i.id into inv_id
  from public.guest_invitations i
  join public.guest_passes p on p.invitation_id = i.id
  where p.guest_profile_id = uid
  order by (i.status = 'activated') desc, p.created_at desc
  limit 1
  for update of i;
  if inv_id is null then
    perform private.log_event(null, 'reception_qr_scanned', station.id, 'no_pass');
    return jsonb_build_object('result', 'no_pass', 'server_now', clock_timestamp());
  end if;
  select * into inv from public.guest_invitations where id = inv_id;

  if inv.status = 'activated' and inv.expires_at <= now() then
    update public.guest_invitations
    set status = 'expired', expired_at = now(),
        pass_returned = private.setting_bool('guest_pass.refund_expired_unused', true)
    where id = inv.id;
    perform private.log_event(inv.id, 'gift_expired');
    inv.status := 'expired';
  end if;

  if inv.status = 'expired' then
    perform private.log_event(inv.id, 'reception_qr_scanned', station.id, 'expired');
    return jsonb_build_object('result', 'expired', 'valid_until', inv.expires_at, 'server_now', clock_timestamp());
  end if;
  if inv.status in ('used', 'converted') then
    perform private.log_event(inv.id, 'reception_qr_scanned', station.id, 'already_used');
    select r.redeemed_at, st.name into prev
    from public.guest_passes p
    join public.guest_redemptions r on r.guest_pass_id = p.id
    join public.reception_stations st on st.id = r.reception_station_id
    where p.invitation_id = inv.id;
    return jsonb_build_object(
      'result', 'already_used',
      'redeemed_at', coalesce(prev.redeemed_at, inv.used_at),
      'reception_station_name', prev.name,
      'confirmation_until', private.confirmation_until(coalesce(prev.redeemed_at, inv.used_at)),
      'server_now', clock_timestamp()
    );
  end if;
  if inv.status <> 'activated' then
    perform private.log_event(inv.id, 'reception_qr_scanned', station.id, 'no_pass');
    return jsonb_build_object('result', 'no_pass', 'server_now', clock_timestamp());
  end if;

  select id into pass_id from public.guest_passes where invitation_id = inv.id;
  insert into public.guest_redemptions (guest_pass_id, guest_profile_id, reception_station_id)
  values (pass_id, uid, station.id)
  returning * into red;
  update public.guest_invitations set status = 'used', used_at = red.redeemed_at where id = inv.id;
  perform private.log_event(inv.id, 'reception_qr_scanned', station.id, 'success');
  perform private.log_event(inv.id, 'guest_pass_redeemed', station.id, 'success');

  return jsonb_build_object(
    'result', 'redeemed',
    'redeemed_at', red.redeemed_at,
    'reception_station_name', station.name,
    'sessions', (select sessions_allowed from public.guest_passes where id = pass_id),
    'confirmation_until', private.confirmation_until(red.redeemed_at),
    'server_now', clock_timestamp()
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Station operations (service role only). Rotation keeps the station row, so
-- redemptions, events and analytics stay attached to the same reception.
-- -----------------------------------------------------------------------------

create or replace function public.deactivate_reception_station(p_station_id uuid)
returns void language sql volatile security definer set search_path = '' as $$
  select public.set_reception_station_active(p_station_id, false)
$$;

create or replace function public.reactivate_reception_station(p_station_id uuid)
returns void language sql volatile security definer set search_path = '' as $$
  select public.set_reception_station_active(p_station_id, true)
$$;

revoke all on function
  public.deactivate_reception_station(uuid),
  public.reactivate_reception_station(uuid)
from public, anon, authenticated;
grant execute on function
  public.deactivate_reception_station(uuid),
  public.reactivate_reception_station(uuid)
to service_role;
