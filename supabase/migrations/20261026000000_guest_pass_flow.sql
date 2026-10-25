-- =============================================================================
-- Guest Pass flow: invitation → share link / short code → activation → QR
--
-- Pass lifecycle (one row per offered pass in guest_invitations):
--
--   [available]  a pass in the member's balance, not yet offered (computed:
--                allowance − invitations that still hold a pass)
--      │ create_guest_invitation()            (balance row locked: no overselling)
--      ▼
--    sent ──activate──▶ activated ──(Sprint 6: reception)──▶ used ──(later)──▶ converted
--      │                   │
--      ├─cancel──▶ cancelled        (pass returned to the balance)
--      └─expiry──▶ expired ◀────────┘  (unused at expires_at: pass returned
--                                       when guest_pass.refund_expired_unused)
--
-- Secrets: share-link token, short fallback code and QR redemption token are
-- three different random values. Only their SHA-256 hashes are stored; raw
-- values are returned once by the RPC that creates them.
-- Every mutation goes through the SECURITY DEFINER functions below; clients
-- have no write access to these tables.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Settings (business rules live in data, not in the apps)
-- -----------------------------------------------------------------------------

insert into public.app_settings (key, value, is_public, description) values
  ('guest_pass.invitation_validity_days', '15', false, 'Days an invitation (and its pass) stays valid'),
  ('guest_pass.sessions_per_pass', '1', false, 'Visits offered by one guest pass'),
  ('guest_pass.refund_expired_unused', 'true', false, 'Return the pass to the member when an invitation expires unused'),
  ('guest_pass.daily_invitation_limit', '10', false, 'Max invitations a member can create per 24 h (abuse guard)'),
  ('guest_pass.code_attempts_limit', '10', false, 'Failed short-code lookups allowed per client per window'),
  ('guest_pass.code_attempts_window_minutes', '15', false, 'Window for short-code rate limiting')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Schema changes
-- -----------------------------------------------------------------------------

-- Members choose whether their first name appears on invitation previews.
alter table public.profiles
  add column show_name_on_invitations boolean not null default true;
grant update (show_name_on_invitations) on public.profiles to authenticated;

alter table public.guest_invitations rename column link_expires_at to expires_at;
alter table public.guest_invitations
  add column short_code_hash bytea not null unique,
  add column pass_returned boolean not null default false,
  add column used_at timestamptz,
  add column expired_at timestamptz,
  add column last_shared_at timestamptz,
  add column link_rotated_at timestamptz,
  add constraint guest_invitations_invitee_name_len check (char_length(invitee_name) <= 60),
  add constraint guest_invitations_claimed_has_guest check (
    status in ('sent', 'cancelled', 'expired') or (guest_profile_id is not null and activated_at is not null)
  ),
  add constraint guest_invitations_cancelled_ts check (status <> 'cancelled' or cancelled_at is not null),
  add constraint guest_invitations_expired_ts check (status <> 'expired' or expired_at is not null),
  add constraint guest_invitations_used_ts check (status not in ('used', 'converted') or used_at is not null);
create index guest_invitations_due_idx on public.guest_invitations (expires_at) where status in ('sent', 'activated');

alter table public.guest_passes
  add column qr_issued_at timestamptz not null default now();

-- Funnel / audit trail (created → shared → opened → activated → used → converted).
create table public.guest_pass_events (
  id bigint generated always as identity primary key,
  invitation_id uuid not null references public.guest_invitations (id) on delete cascade,
  event text not null check (event in (
    'gift_created', 'gift_shared', 'link_rotated', 'invitation_opened',
    'gift_activated', 'gift_cancelled', 'gift_expired', 'qr_reissued'
  )),
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index guest_pass_events_invitation_idx on public.guest_pass_events (invitation_id, created_at);
alter table public.guest_pass_events enable row level security;
create policy "guest_pass_events: admin read" on public.guest_pass_events
  for select to authenticated using (public.is_admin());

-- Failed short-code lookups, for rate limiting (no client access).
create table public.guest_code_attempts (
  id bigint generated always as identity primary key,
  client_key text not null,
  attempted_at timestamptz not null default now()
);
create index guest_code_attempts_client_idx on public.guest_code_attempts (client_key, attempted_at);
alter table public.guest_code_attempts enable row level security;

-- The old availability view is replaced by private.available_passes().
drop view public.guest_pass_availability;

-- Hashes are never readable through the API, even by the people involved
-- (short-code hashes would be brute-forceable offline).
revoke all on public.guest_invitations, public.guest_passes, public.guest_pass_balances,
  public.guest_redemptions, public.guest_pass_events, public.guest_code_attempts from anon, authenticated;
grant select (id, inviter_id, invitee_name, status, expires_at, guest_profile_id, activated_at, cancelled_at,
  converted_at, used_at, expired_at, last_shared_at, created_at, updated_at)
  on public.guest_invitations to authenticated;
grant select (id, invitation_id, guest_profile_id, sessions_allowed, valid_until, qr_issued_at, created_at, updated_at)
  on public.guest_passes to authenticated;
grant select on public.guest_pass_balances, public.guest_redemptions, public.guest_pass_events to authenticated;

-- -----------------------------------------------------------------------------
-- Private helpers (schema not exposed by the API)
-- -----------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.setting_int(p_key text, p_default int)
returns int language sql stable set search_path = '' as $$
  select coalesce((select (s.value #>> '{}')::int from public.app_settings s where s.key = p_key), p_default)
$$;

create or replace function private.setting_bool(p_key text, p_default boolean)
returns boolean language sql stable set search_path = '' as $$
  select coalesce((select (s.value #>> '{}')::boolean from public.app_settings s where s.key = p_key), p_default)
$$;

create or replace function private.sha256(p_value text)
returns bytea language sql immutable set search_path = '' as $$
  select extensions.digest(convert_to(p_value, 'UTF8'), 'sha256')
$$;

-- 256-bit URL-safe token (share link, QR).
create or replace function private.random_token()
returns text language sql volatile set search_path = '' as $$
  select rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=')
$$;

-- Short fallback code "AF-XXXX-XXXX": 8 symbols from a 31-letter alphabet
-- without look-alikes (0/O, 1/I/L) ≈ 39.6 bits; rejection sampling keeps it
-- unbiased. Guessing is further limited by private.code_rate_limited().
create or replace function private.random_code()
returns text language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  result text := '';
  b int;
begin
  while char_length(result) < 8 loop
    b := get_byte(extensions.gen_random_bytes(1), 0);
    if b < 248 then -- 248 = 31 × 8
      result := result || substr(alphabet, (b % 31) + 1, 1);
    end if;
  end loop;
  return 'AF-' || substr(result, 1, 4) || '-' || substr(result, 5, 4);
end;
$$;

-- Canonical form of a user-typed code, or null when it can't be one.
create or replace function private.normalize_code(p_code text)
returns text language sql immutable set search_path = '' as $$
  select case
    when c ~ '^AF[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$' then 'AF-' || substr(c, 3, 4) || '-' || substr(c, 7, 4)
  end
  from (select regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g') as c) n
$$;

-- Who is knocking, for rate limiting: the user id, else the client IP
-- forwarded by the Supabase gateway, else a shared bucket.
create or replace function private.client_key()
returns text language sql stable set search_path = '' as $$
  select coalesce(
    (select auth.uid())::text,
    nullif(trim(split_part(
      coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for'), ''), ',', 1)), ''),
    'unknown'
  )
$$;

create or replace function private.code_rate_limited()
returns boolean language sql stable set search_path = '' as $$
  select count(*) >= private.setting_int('guest_pass.code_attempts_limit', 10)
  from public.guest_code_attempts
  where client_key = private.client_key()
    and attempted_at > now() - make_interval(mins => private.setting_int('guest_pass.code_attempts_window_minutes', 15))
$$;

create or replace function private.record_code_failure()
returns void language sql volatile set search_path = '' as $$
  delete from public.guest_code_attempts where attempted_at < now() - interval '1 day';
  insert into public.guest_code_attempts (client_key) values (private.client_key());
$$;

create or replace function private.log_event(p_invitation uuid, p_event text)
returns void language sql volatile set search_path = '' as $$
  insert into public.guest_pass_events (invitation_id, event, actor_id) values (p_invitation, p_event, auth.uid());
$$;

create or replace function private.is_eligible_member(p_user uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1
    from public.profiles p
    join public.memberships m on m.profile_id = p.id
    where p.id = p_user
      and p.kind = 'member'
      and m.status = 'active'
      and m.starts_on <= current_date
      and (m.ends_on is null or m.ends_on >= current_date)
  )
$$;

-- Passes the member can still offer.
create or replace function private.available_passes(p_member uuid)
returns int language sql stable set search_path = '' as $$
  select coalesce(b.allowance, 0) - (
    select count(*) from public.guest_invitations i where i.inviter_id = p_member and not i.pass_returned
  )::int
  from (select 1) x
  left join public.guest_pass_balances b on b.member_id = p_member
$$;

-- Expires unused invitations whose date has passed. Idempotent: only rows
-- still 'sent'/'activated' are touched, and the pass is returned at most once
-- (pass_returned is set in the same update). Scoped to one inviter or guest
-- when called lazily from an RPC; the scheduled job passes no filter.
create or replace function private.expire_due(p_inviter uuid default null, p_guest uuid default null)
returns int language plpgsql volatile set search_path = '' as $$
declare
  refund boolean := private.setting_bool('guest_pass.refund_expired_unused', true);
  n int;
begin
  with expired as (
    update public.guest_invitations i
    set status = 'expired', expired_at = now(), pass_returned = refund
    where i.status in ('sent', 'activated')
      and i.expires_at <= now()
      and (p_inviter is null or i.inviter_id = p_inviter)
      and (p_guest is null or i.guest_profile_id = p_guest)
    returning i.id
  ), logged as (
    insert into public.guest_pass_events (invitation_id, event, actor_id)
    select id, 'gift_expired', null from expired
    returning 1
  )
  select count(*) into n from logged;
  return n;
end;
$$;

-- Invitation id for a share token or a short code (null if none matches).
create or replace function private.find_invitation(p_token text, p_code text)
returns uuid language sql stable set search_path = '' as $$
  select i.id from public.guest_invitations i
  where (p_token is not null and i.link_token_hash = private.sha256(p_token))
     or (p_code is not null and private.normalize_code(p_code) is not null
         and i.short_code_hash = private.sha256(private.normalize_code(p_code)))
  limit 1
$$;

create or replace function private.inviter_display_name(p_inviter uuid)
returns text language sql stable set search_path = '' as $$
  select case when p.show_name_on_invitations then nullif(trim(p.first_name), '') end
  from public.profiles p where p.id = p_inviter
$$;

-- -----------------------------------------------------------------------------
-- Member operations
-- -----------------------------------------------------------------------------

-- Creates an invitation: atomically reserves one pass and returns the raw
-- share token and short code ONCE (only their hashes are stored).
create or replace function public.create_guest_invitation(p_invitee_name text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  token text;
  code text;
  inv public.guest_invitations;
  validity int := private.setting_int('guest_pass.invitation_validity_days', 15);
  name text := nullif(trim(p_invitee_name), '');
begin
  if uid is null or not private.is_eligible_member(uid) then
    raise exception 'gp_not_eligible' using errcode = 'P0001';
  end if;
  if validity < 1 then
    raise exception 'gp_invalid_configuration' using errcode = 'P0001';
  end if;
  if char_length(name) > 60 then
    raise exception 'gp_invalid_name' using errcode = 'P0001';
  end if;

  -- Serialise this member's creations: concurrent taps queue on this lock.
  insert into public.guest_pass_balances (member_id, allowance)
  values (uid, private.setting_int('guest_pass.default_allowance', 3))
  on conflict (member_id) do nothing;
  perform 1 from public.guest_pass_balances where member_id = uid for update;

  perform private.expire_due(uid, null);

  if private.available_passes(uid) <= 0 then
    raise exception 'gp_no_pass_available' using errcode = 'P0001';
  end if;
  if (select count(*) from public.guest_invitations
      where inviter_id = uid and created_at > now() - interval '24 hours')
     >= private.setting_int('guest_pass.daily_invitation_limit', 10) then
    raise exception 'gp_daily_limit' using errcode = 'P0001';
  end if;

  loop
    token := private.random_token();
    code := private.random_code();
    begin
      insert into public.guest_invitations (inviter_id, invitee_name, link_token_hash, short_code_hash, expires_at)
      values (uid, name, private.sha256(token), private.sha256(code), now() + make_interval(days => validity))
      returning * into inv;
      exit;
    exception when unique_violation then
      -- astronomically unlikely token/code collision: draw again
    end;
  end loop;

  perform private.log_event(inv.id, 'gift_created');

  return jsonb_build_object(
    'invitation_id', inv.id,
    'share_token', token,
    'short_code', code,
    'expires_at', inv.expires_at,
    'available', private.available_passes(uid)
  );
end;
$$;

-- The member's balance and invitations (expiry applied first).
create or replace function public.get_my_guest_invitations()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not private.is_eligible_member(uid) then
    raise exception 'gp_not_eligible' using errcode = 'P0001';
  end if;
  insert into public.guest_pass_balances (member_id, allowance)
  values (uid, private.setting_int('guest_pass.default_allowance', 3))
  on conflict (member_id) do nothing;
  perform private.expire_due(uid, null);

  return jsonb_build_object(
    'allowance', (select allowance from public.guest_pass_balances where member_id = uid),
    'available', private.available_passes(uid),
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'invitee_name', i.invitee_name,
        'status', i.status,
        'created_at', i.created_at,
        'expires_at', i.expires_at,
        'activated_at', i.activated_at,
        'used_at', i.used_at,
        'cancelled_at', i.cancelled_at,
        'expired_at', i.expired_at,
        'converted_at', i.converted_at,
        'last_shared_at', i.last_shared_at
      ) order by i.created_at desc)
      from public.guest_invitations i where i.inviter_id = uid
    ), '[]'::jsonb)
  );
end;
$$;

-- "Partager à nouveau": the raw secrets are never stored, so a fresh link and
-- code are issued and the previous ones stop working. Only before activation.
create or replace function public.reshare_guest_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv public.guest_invitations;
  token text;
  code text;
begin
  if uid is null then raise exception 'gp_not_eligible' using errcode = 'P0001'; end if;
  perform private.expire_due(uid, null);
  select * into inv from public.guest_invitations where id = p_invitation_id and inviter_id = uid for update;
  if not found then raise exception 'gp_not_found' using errcode = 'P0001'; end if;
  if inv.status <> 'sent' then raise exception 'gp_not_shareable' using errcode = 'P0001'; end if;

  loop
    token := private.random_token();
    code := private.random_code();
    begin
      update public.guest_invitations
      set link_token_hash = private.sha256(token), short_code_hash = private.sha256(code), link_rotated_at = now()
      where id = inv.id;
      exit;
    exception when unique_violation then
    end;
  end loop;
  perform private.log_event(inv.id, 'link_rotated');
  return jsonb_build_object('invitation_id', inv.id, 'share_token', token, 'short_code', code, 'expires_at', inv.expires_at);
end;
$$;

-- Reported by the app after the share sheet completes (funnel analytics).
create or replace function public.record_guest_invitation_shared(p_invitation_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.guest_invitations set last_shared_at = now()
  where id = p_invitation_id and inviter_id = auth.uid() and status = 'sent';
  if found then perform private.log_event(p_invitation_id, 'gift_shared'); end if;
end;
$$;

-- Cancels an invitation that nobody activated; its pass returns to the balance.
create or replace function public.cancel_guest_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv public.guest_invitations;
begin
  if uid is null then raise exception 'gp_not_eligible' using errcode = 'P0001'; end if;
  perform 1 from public.guest_pass_balances where member_id = uid for update;
  perform private.expire_due(uid, null);
  select * into inv from public.guest_invitations where id = p_invitation_id and inviter_id = uid for update;
  if not found then raise exception 'gp_not_found' using errcode = 'P0001'; end if;
  if inv.status <> 'sent' then raise exception 'gp_not_cancellable' using errcode = 'P0001'; end if;

  update public.guest_invitations
  set status = 'cancelled', cancelled_at = now(), pass_returned = true
  where id = inv.id;
  perform private.log_event(inv.id, 'gift_cancelled');
  return jsonb_build_object('status', 'cancelled', 'available', private.available_passes(uid));
end;
$$;

-- -----------------------------------------------------------------------------
-- Guest operations
-- -----------------------------------------------------------------------------

-- Public preview of an invitation, reachable only with its share token or
-- short code. Never returns ids, hashes or member data beyond the inviter's
-- first name (if they allow it). Failed code lookups are rate limited.
create or replace function public.preview_guest_invitation(p_token text default null, p_code text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  inv_id uuid;
  inv public.guest_invitations;
  outcome text;
begin
  if p_token is null and p_code is null then
    return jsonb_build_object('result', 'invalid');
  end if;
  if p_token is null and private.code_rate_limited() then
    return jsonb_build_object('result', 'rate_limited');
  end if;

  inv_id := private.find_invitation(p_token, p_code);
  if inv_id is null then
    if p_token is null then perform private.record_code_failure(); end if;
    return jsonb_build_object('result', 'invalid');
  end if;

  update public.guest_invitations
  set status = 'expired', expired_at = now(),
      pass_returned = private.setting_bool('guest_pass.refund_expired_unused', true)
  where id = inv_id and status in ('sent', 'activated') and expires_at <= now();
  if found then perform private.log_event(inv_id, 'gift_expired'); end if;

  select * into inv from public.guest_invitations where id = inv_id;
  perform private.log_event(inv.id, 'invitation_opened');

  outcome := case
    when inv.status = 'sent' then 'valid'
    when inv.status in ('activated', 'used', 'converted') and inv.guest_profile_id = auth.uid() then 'yours'
    when inv.status in ('activated', 'used', 'converted') then 'already_claimed'
    else inv.status::text -- 'expired' | 'cancelled'
  end;

  return jsonb_build_object(
    'result', outcome,
    'inviter_name', private.inviter_display_name(inv.inviter_id),
    'sessions', private.setting_int('guest_pass.sessions_per_pass', 1),
    'expires_at', inv.expires_at
  );
end;
$$;

-- Atomic, idempotent activation by the calling guest identity.
--   result: activated (qr_token returned once) | already_active | expired |
--           cancelled | already_claimed | used | own_invitation |
--           not_eligible | has_active_pass | invalid | rate_limited
create or replace function public.activate_guest_invitation(p_token text default null, p_code text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv_id uuid;
  inv public.guest_invitations;
  qr text;
  pass public.guest_passes;
begin
  if uid is null then return jsonb_build_object('result', 'not_eligible'); end if;
  if (select kind from public.profiles where id = uid) = 'member' then
    return jsonb_build_object('result', 'not_eligible');
  end if;
  if p_token is null and private.code_rate_limited() then
    return jsonb_build_object('result', 'rate_limited');
  end if;

  inv_id := private.find_invitation(p_token, p_code);
  if inv_id is null then
    if p_token is null then perform private.record_code_failure(); end if;
    return jsonb_build_object('result', 'invalid');
  end if;

  -- One activation at a time per guest (one active pass each) and per
  -- invitation (one pass each): concurrent calls wait on these locks.
  perform 1 from public.profiles where id = uid for update;
  select * into inv from public.guest_invitations where id = inv_id for update;

  if inv.status in ('sent', 'activated') and inv.expires_at <= now() then
    update public.guest_invitations
    set status = 'expired', expired_at = now(),
        pass_returned = private.setting_bool('guest_pass.refund_expired_unused', true)
    where id = inv.id;
    perform private.log_event(inv.id, 'gift_expired');
    return jsonb_build_object('result', 'expired');
  end if;

  if inv.inviter_id = uid then return jsonb_build_object('result', 'own_invitation'); end if;

  if inv.status in ('activated', 'used', 'converted') then
    if inv.guest_profile_id <> uid then return jsonb_build_object('result', 'already_claimed'); end if;
    -- Same guest again: return the existing pass, never a second one.
    return jsonb_build_object('result', case when inv.status = 'activated' then 'already_active' else 'used' end,
      'pass', public.get_my_guest_pass());
  end if;
  if inv.status <> 'sent' then return jsonb_build_object('result', inv.status::text); end if;

  -- One active pass per guest identity.
  if exists (
    select 1 from public.guest_invitations
    where guest_profile_id = uid and status = 'activated' and expires_at > now()
  ) then
    return jsonb_build_object('result', 'has_active_pass');
  end if;

  qr := private.random_token();
  update public.guest_invitations
  set status = 'activated', guest_profile_id = uid, activated_at = now()
  where id = inv.id;
  insert into public.guest_passes (invitation_id, guest_profile_id, qr_token_hash, sessions_allowed, valid_until)
  values (inv.id, uid, private.sha256(qr), private.setting_int('guest_pass.sessions_per_pass', 1), inv.expires_at)
  returning * into pass;
  perform private.log_event(inv.id, 'gift_activated');

  return jsonb_build_object('result', 'activated', 'qr_token', qr, 'pass', public.get_my_guest_pass());
end;
$$;

-- The caller's current guest pass (most recent), or null.
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
    'used_at', i.used_at,
    'qr_issued_at', p.qr_issued_at
  ) into result
  from public.guest_passes p
  join public.guest_invitations i on i.id = p.invitation_id
  where p.guest_profile_id = uid
  order by p.created_at desc
  limit 1;
  return result;
end;
$$;

-- New QR token for the caller's active pass (e.g. the device lost it). The
-- previous token stops working; returned once, stored hashed.
create or replace function public.reissue_guest_pass_qr()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  pass_id uuid;
  inv_id uuid;
  qr text;
begin
  if uid is null then raise exception 'gp_no_active_pass' using errcode = 'P0001'; end if;
  perform private.expire_due(null, uid);
  select p.id, p.invitation_id into pass_id, inv_id
  from public.guest_passes p join public.guest_invitations i on i.id = p.invitation_id
  where p.guest_profile_id = uid and i.status = 'activated'
  order by p.created_at desc limit 1
  for update of p;
  if pass_id is null then raise exception 'gp_no_active_pass' using errcode = 'P0001'; end if;

  loop
    qr := private.random_token();
    begin
      update public.guest_passes set qr_token_hash = private.sha256(qr), qr_issued_at = now() where id = pass_id;
      exit;
    exception when unique_violation then
    end;
  end loop;
  perform private.log_event(inv_id, 'qr_reissued');
  return jsonb_build_object('qr_token', qr);
end;
$$;

-- -----------------------------------------------------------------------------
-- Scheduled expiry (server job; never callable from the apps)
-- -----------------------------------------------------------------------------

create or replace function public.expire_guest_invitations()
returns int
language sql
volatile
security definer
set search_path = ''
as $$ select private.expire_due(null, null) $$;

-- Expiry is also applied lazily by every RPC above, so correctness never
-- depends on the job; the job keeps statuses tidy for reporting. On Supabase,
-- enable pg_cron and this schedules itself:
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('expire-guest-invitations', '*/15 * * * *', 'select public.expire_guest_invitations()');
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Execute privileges (Supabase grants EXECUTE to anon/authenticated by default)
-- -----------------------------------------------------------------------------

revoke all on function
  public.create_guest_invitation(text),
  public.get_my_guest_invitations(),
  public.reshare_guest_invitation(uuid),
  public.record_guest_invitation_shared(uuid),
  public.cancel_guest_invitation(uuid),
  public.preview_guest_invitation(text, text),
  public.activate_guest_invitation(text, text),
  public.get_my_guest_pass(),
  public.reissue_guest_pass_qr(),
  public.expire_guest_invitations()
from public, anon, authenticated;

grant execute on function public.preview_guest_invitation(text, text) to anon, authenticated;
grant execute on function
  public.create_guest_invitation(text),
  public.get_my_guest_invitations(),
  public.reshare_guest_invitation(uuid),
  public.record_guest_invitation_shared(uuid),
  public.cancel_guest_invitation(uuid),
  public.activate_guest_invitation(text, text),
  public.get_my_guest_pass(),
  public.reissue_guest_pass_qr()
to authenticated;
grant execute on function public.expire_guest_invitations() to service_role;
