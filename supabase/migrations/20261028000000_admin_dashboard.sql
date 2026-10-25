-- =============================================================================
-- Admin dashboard (Sprint 7): staff roles, role-aware RLS, audit log, admin RPCs
--
-- Roles (public.admin_users.role):
--   admin            everything
--   content_manager  planning, activities, coaches, rooms, news, notification drafts, images
--   reception        guest pass operational view, reception station list (read-only)
-- Roles are granted only by an admin (or the service role); nobody can grant
-- themselves a role. Every check lives in the database (RLS + functions); the
-- dashboard's route guards are convenience only.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Roles
-- -----------------------------------------------------------------------------

-- text + check instead of extending the enum (new enum values can't be used in
-- the transaction that adds them).
alter table public.admin_users alter column role type text using role::text;
alter table public.admin_users
  add constraint admin_users_role_check check (role in ('admin', 'content_manager', 'reception'));
drop type public.staff_role;

create or replace function public.current_staff_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.admin_users where user_id = (select auth.uid())
$$;

create or replace function public.can_manage_content()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid()) and role in ('admin', 'content_manager')
  )
$$;

create or replace function public.can_view_guest_passes()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid()) and role in ('admin', 'reception')
  )
$$;

-- -----------------------------------------------------------------------------
-- Content: content managers write, staff with content rights see drafts/hidden
-- -----------------------------------------------------------------------------

drop policy "coaches: public read" on public.coaches;
drop policy "coaches: admin all" on public.coaches;
create policy "coaches: public read" on public.coaches
  for select to anon, authenticated using (is_active or public.can_manage_content());
create policy "coaches: content write" on public.coaches
  for all to authenticated using (public.can_manage_content()) with check (public.can_manage_content());

drop policy "activities: public read" on public.activities;
drop policy "activities: admin all" on public.activities;
create policy "activities: public read" on public.activities
  for select to anon, authenticated using (is_active or public.can_manage_content());
create policy "activities: content write" on public.activities
  for all to authenticated using (public.can_manage_content()) with check (public.can_manage_content());

drop policy "coach_activities: admin all" on public.coach_activities;
create policy "coach_activities: content write" on public.coach_activities
  for all to authenticated using (public.can_manage_content()) with check (public.can_manage_content());

drop policy "rooms: public read" on public.rooms;
drop policy "rooms: admin all" on public.rooms;
create policy "rooms: public read" on public.rooms
  for select to anon, authenticated using (is_active or public.can_manage_content());
create policy "rooms: content write" on public.rooms
  for all to authenticated using (public.can_manage_content()) with check (public.can_manage_content());

drop policy "class_sessions: read visible" on public.class_sessions;
drop policy "class_sessions: admin all" on public.class_sessions;
create policy "class_sessions: read visible" on public.class_sessions
  for select to anon, authenticated using (
    visibility = 'public'
    or (visibility = 'members' and public.is_member())
    or public.can_manage_content()
  );
create policy "class_sessions: content write" on public.class_sessions
  for all to authenticated using (public.can_manage_content()) with check (public.can_manage_content());
alter table public.class_sessions alter column created_by set default auth.uid();

drop policy "news: read published" on public.news;
drop policy "news: admin all" on public.news;
create policy "news: read published" on public.news
  for select to anon, authenticated using (
    (status = 'published' and published_at <= now()) or public.can_manage_content()
  );
create policy "news: content write" on public.news
  for all to authenticated using (public.can_manage_content()) with check (public.can_manage_content());
alter table public.news alter column created_by set default auth.uid();

-- Coaches and activities are never hard-deleted from the apps (history keeps
-- pointing at them): deactivate instead.
revoke delete on public.coaches, public.activities from authenticated;

-- Notifications: drafts only. Push delivery isn't wired yet (device tokens,
-- final auth, Expo/FCM/APNs), so the apps can't mark anything scheduled/sent.
drop policy "notifications: admin all" on public.notifications;
create policy "notifications: content read" on public.notifications
  for select to authenticated using (public.can_manage_content());
create policy "notifications: content write drafts" on public.notifications
  for insert to authenticated with check (public.can_manage_content() and status = 'draft');
create policy "notifications: content update drafts" on public.notifications
  for update to authenticated using (public.can_manage_content() and status = 'draft')
  with check (public.can_manage_content() and status = 'draft');
create policy "notifications: content delete drafts" on public.notifications
  for delete to authenticated using (public.can_manage_content() and status = 'draft');
revoke insert, update on public.notifications from authenticated;
grant insert (category, title, body, deep_link, audience, audience_activity_ids),
      update (category, title, body, deep_link, audience, audience_activity_ids)
  on public.notifications to authenticated;
alter table public.notifications alter column created_by set default auth.uid();
alter table public.notifications
  add constraint notifications_title_len check (char_length(title) between 1 and 80),
  add constraint notifications_body_len check (char_length(body) between 1 and 300),
  add constraint notifications_deep_link_safe check (deep_link is null or deep_link ~ '^arenafit://[A-Za-z0-9/_-]*$');

-- Images: content managers upload to the public content buckets (type/size
-- limits are enforced by the buckets: images only, 5 MB).
drop policy "content buckets: admin write" on storage.objects;
create policy "content buckets: content write" on storage.objects
  for all to authenticated
  using (bucket_id in ('coaches', 'activities', 'classes', 'news') and public.can_manage_content())
  with check (bucket_id in ('coaches', 'activities', 'classes', 'news') and public.can_manage_content());

-- Guest pass data: admin + reception (not content managers).
drop policy "guest_invitations: read involved" on public.guest_invitations;
create policy "guest_invitations: read involved" on public.guest_invitations
  for select to authenticated using (
    inviter_id = (select auth.uid())
    or guest_profile_id = (select auth.uid())
    or public.can_view_guest_passes()
  );
drop policy "guest_passes: read own" on public.guest_passes;
create policy "guest_passes: read own" on public.guest_passes
  for select to authenticated using (guest_profile_id = (select auth.uid()) or public.can_view_guest_passes());
drop policy "guest_redemptions: staff read" on public.guest_redemptions;
create policy "guest_redemptions: staff read" on public.guest_redemptions
  for select to authenticated using (public.can_view_guest_passes());

-- -----------------------------------------------------------------------------
-- Audit log (written by triggers / functions only; admins read)
-- -----------------------------------------------------------------------------

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary jsonb not null default '{}'::jsonb,   -- never secrets
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_entity_idx on public.admin_audit_log (entity_type, entity_id);
alter table public.admin_audit_log enable row level security;
create policy "admin_audit_log: admin read" on public.admin_audit_log
  for select to authenticated using (public.is_admin());
revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;

create or replace function private.audit(p_action text, p_entity_type text, p_entity_id uuid, p_summary jsonb default '{}')
returns void language sql volatile set search_path = '' as $$
  insert into public.admin_audit_log (actor_id, actor_role, action, entity_type, entity_id, summary)
  values (
    auth.uid(),
    coalesce((select role from public.admin_users where user_id = auth.uid()), case when auth.uid() is null then 'system' end),
    p_action, p_entity_type, p_entity_id, coalesce(p_summary, '{}')
  );
$$;

-- Names of the columns that changed (values are not copied into the log).
create or replace function private.changed_columns(p_old jsonb, p_new jsonb, p_ignore text[] default '{}')
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(n.key order by n.key), '[]'::jsonb)
  from jsonb_each(p_new) n
  where n.key <> all (p_ignore || array['updated_at']) and n.value is distinct from (p_old -> n.key)
$$;

create or replace function private.audit_class_sessions()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  s public.class_sessions := coalesce(new, old);
  info jsonb := jsonb_build_object('date', s.session_date, 'start', to_char(s.start_time, 'HH24:MI'),
    'activity', (select name from public.activities where id = s.activity_id));
begin
  if tg_op = 'INSERT' then
    perform private.audit('session.created', 'class_session', new.id, info);
  elsif tg_op = 'DELETE' then
    perform private.audit('session.deleted', 'class_session', old.id, info);
  elsif new.is_cancelled and not old.is_cancelled then
    perform private.audit('session.cancelled', 'class_session', new.id, info);
  elsif old.is_cancelled and not new.is_cancelled then
    perform private.audit('session.restored', 'class_session', new.id, info);
  elsif private.changed_columns(to_jsonb(old), to_jsonb(new)) <> '[]'::jsonb then
    perform private.audit('session.updated', 'class_session', new.id,
      info || jsonb_build_object('changed', private.changed_columns(to_jsonb(old), to_jsonb(new)),
        'from', jsonb_build_object('date', old.session_date, 'start', to_char(old.start_time, 'HH24:MI'))));
  end if;
  return null;
end;
$$;
create trigger audit_class_sessions after insert or update or delete on public.class_sessions
  for each row execute function private.audit_class_sessions();

create or replace function private.audit_news()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  n public.news := coalesce(new, old);
  info jsonb := jsonb_build_object('title', n.title);
begin
  if tg_op = 'INSERT' then
    perform private.audit(case when new.status = 'published' then 'news.published' else 'news.created' end, 'news', new.id, info);
  elsif tg_op = 'DELETE' then
    perform private.audit('news.deleted', 'news', old.id, info);
  elsif new.status = 'published' and old.status = 'draft' then
    perform private.audit('news.published', 'news', new.id, info || jsonb_build_object('published_at', new.published_at));
  elsif new.status = 'draft' and old.status = 'published' then
    perform private.audit('news.unpublished', 'news', new.id, info);
  elsif private.changed_columns(to_jsonb(old), to_jsonb(new)) <> '[]'::jsonb then
    perform private.audit('news.updated', 'news', new.id, info || jsonb_build_object('changed', private.changed_columns(to_jsonb(old), to_jsonb(new))));
  end if;
  return null;
end;
$$;
create trigger audit_news after insert or update or delete on public.news
  for each row execute function private.audit_news();

-- Coaches and activities share the same shape of audit.
create or replace function private.audit_catalogue()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  kind text := case tg_table_name when 'coaches' then 'coach' else 'activity' end;
  label text := coalesce(to_jsonb(new) ->> 'display_name', to_jsonb(new) ->> 'name');
  info jsonb := jsonb_build_object('name', label);
begin
  if tg_op = 'INSERT' then
    perform private.audit(kind || '.created', kind, new.id, info);
  elsif old.is_active and not new.is_active then
    perform private.audit(kind || '.deactivated', kind, new.id, info);
  elsif new.is_active and not old.is_active then
    perform private.audit(kind || '.reactivated', kind, new.id, info);
  elsif private.changed_columns(to_jsonb(old), to_jsonb(new)) <> '[]'::jsonb then
    perform private.audit(kind || '.updated', kind, new.id, info || jsonb_build_object('changed', private.changed_columns(to_jsonb(old), to_jsonb(new))));
  end if;
  return null;
end;
$$;
create trigger audit_coaches after insert or update on public.coaches
  for each row execute function private.audit_catalogue();
create trigger audit_activities after insert or update on public.activities
  for each row execute function private.audit_catalogue();

-- Stations: also when operated from the SQL editor (service role → actor 'system').
create or replace function private.audit_reception_stations()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  info jsonb := jsonb_build_object('name', new.name);
begin
  if tg_op = 'INSERT' then
    perform private.audit('station.created', 'reception_station', new.id, info);
    return null;
  end if;
  if new.token_hash is distinct from old.token_hash then
    perform private.audit('station.rotated', 'reception_station', new.id, info);
  end if;
  if old.active and not new.active then
    perform private.audit('station.deactivated', 'reception_station', new.id, info);
  elsif new.active and not old.active then
    perform private.audit('station.reactivated', 'reception_station', new.id, info);
  end if;
  if new.name is distinct from old.name then
    perform private.audit('station.renamed', 'reception_station', new.id, info || jsonb_build_object('from', old.name));
  end if;
  return null;
end;
$$;
create trigger audit_reception_stations after insert or update on public.reception_stations
  for each row execute function private.audit_reception_stations();

-- -----------------------------------------------------------------------------
-- Admin RPCs (security definer; each checks the caller's role first)
-- -----------------------------------------------------------------------------

create or replace function private.require(p_ok boolean)
returns void language plpgsql stable set search_path = '' as $$
begin
  if not coalesce(p_ok, false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- Who am I in the dashboard (null for non-staff).
create or replace function public.admin_whoami()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('user_id', a.user_id, 'role', a.role, 'display_name', a.display_name,
    'email', (select email from auth.users where id = a.user_id))
  from public.admin_users a where a.user_id = (select auth.uid())
$$;

-- Overview cards. Only metrics the backend really has.
create or replace function public.admin_dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  today date := public.club_local_timestamp(now())::date;
  monday date := today - (extract(isodow from today)::int - 1);
begin
  perform private.require(public.is_staff());
  return jsonb_build_object(
    'club_today', today,
    'sessions_today', (select count(*) from public.class_sessions where session_date = today and not is_cancelled),
    'sessions_week', (select count(*) from public.class_sessions where session_date between monday and monday + 6 and not is_cancelled),
    'cancelled_week', (select count(*) from public.class_sessions where session_date between monday and monday + 6 and is_cancelled),
    'news_published', (select count(*) from public.news where status = 'published' and published_at <= now()),
    'news_drafts', (select count(*) from public.news where status = 'draft'),
    'passes_active', (select count(*) from public.guest_invitations where status = 'activated' and expires_at > now()),
    'passes_used_today', (select count(*) from public.guest_redemptions where public.club_local_timestamp(redeemed_at)::date = today),
    'invitations_pending', (select count(*) from public.guest_invitations where status = 'sent' and expires_at > now())
  );
end;
$$;

-- Copies a session to other dates (same times, activity, coach, room, level,
-- visibility, description, image). Dates that already have the same activity
-- at the same time are skipped, so repeating the action is harmless.
create or replace function public.admin_duplicate_session(p_session_id uuid, p_dates date[])
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  src public.class_sessions;
  d date;
  created uuid[] := '{}';
  skipped date[] := '{}';
  new_id uuid;
begin
  perform private.require(public.can_manage_content());
  if p_dates is null or cardinality(p_dates) = 0 or cardinality(p_dates) > 62 then
    raise exception 'invalid_dates' using errcode = '22023';
  end if;
  select * into src from public.class_sessions where id = p_session_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  foreach d in array (select array_agg(distinct x order by x) from unnest(p_dates) x) loop
    if exists (select 1 from public.class_sessions
               where session_date = d and start_time = src.start_time and activity_id = src.activity_id and not is_cancelled) then
      skipped := skipped || d;
      continue;
    end if;
    insert into public.class_sessions (activity_id, coach_id, room_id, session_date, start_time, end_time, level,
      description, visibility, image_path)
    values (src.activity_id, src.coach_id, src.room_id, d, src.start_time, src.end_time, src.level,
      src.description, src.visibility, src.image_path)
    returning id into new_id;
    created := created || new_id;
  end loop;
  perform private.audit('session.duplicated', 'class_session', src.id,
    jsonb_build_object('created', cardinality(created), 'skipped', to_jsonb(skipped)));
  return jsonb_build_object('created', to_jsonb(created), 'skipped', to_jsonb(skipped));
end;
$$;

-- Replaces a coach's activities.
create or replace function public.admin_set_coach_activities(p_coach_id uuid, p_activity_ids uuid[])
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require(public.can_manage_content());
  if not exists (select 1 from public.coaches where id = p_coach_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  delete from public.coach_activities where coach_id = p_coach_id and activity_id <> all (coalesce(p_activity_ids, '{}'));
  insert into public.coach_activities (coach_id, activity_id)
  select p_coach_id, a from unnest(coalesce(p_activity_ids, '{}')) a
  on conflict do nothing;
  perform private.audit('coach.activities_updated', 'coach', p_coach_id,
    jsonb_build_object('count', cardinality(coalesce(p_activity_ids, '{}'))));
end;
$$;

-- Guest passes, safe view: no tokens, hashes or guest identities.
create or replace function private.admin_invitation_row(i public.guest_invitations)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', i.id,
    'inviter_name', nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
    'invitee_name', i.invitee_name,
    'status', i.status,
    'guest_activated', i.guest_profile_id is not null,
    'created_at', i.created_at,
    'last_shared_at', i.last_shared_at,
    'activated_at', i.activated_at,
    'expires_at', i.expires_at,
    'expired_at', i.expired_at,
    'cancelled_at', i.cancelled_at,
    'used_at', i.used_at,
    'converted_at', i.converted_at,
    'redeemed_at', r.redeemed_at,
    'reception_station_name', st.name
  )
  from (select 1) x
  left join public.profiles p on p.id = i.inviter_id
  left join public.guest_passes gp on gp.invitation_id = i.id
  left join public.guest_redemptions r on r.guest_pass_id = gp.id
  left join public.reception_stations st on st.id = r.reception_station_id
$$;

create or replace function public.admin_list_guest_invitations(p_status text default null, p_search text default null, p_limit int default 200)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require(public.can_view_guest_passes());
  perform private.expire_due(null, null);
  return coalesce((
    select jsonb_agg(private.admin_invitation_row(i) order by i.created_at desc)
    from (
      select i.* from public.guest_invitations i
      left join public.profiles p on p.id = i.inviter_id
      where (p_status is null or i.status::text = p_status)
        and (p_search is null or p_search = ''
             or concat_ws(' ', p.first_name, p.last_name, i.invitee_name) ilike '%' || p_search || '%')
      order by i.created_at desc
      limit least(greatest(coalesce(p_limit, 200), 1), 500)
    ) i
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_guest_invitation_detail(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  inv public.guest_invitations;
begin
  perform private.require(public.can_view_guest_passes());
  perform private.expire_due(null, null);
  select * into inv from public.guest_invitations where id = p_id;
  if not found then return null; end if;
  return private.admin_invitation_row(inv) || jsonb_build_object(
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('event', e.event, 'outcome', e.outcome, 'station_name', st.name,
        'created_at', e.created_at) order by e.created_at)
      from public.guest_pass_events e
      left join public.reception_stations st on st.id = e.reception_station_id
      where e.invitation_id = p_id
    ), '[]'::jsonb)
  );
end;
$$;

-- Cancel an unused invitation on a member's behalf (pass returned).
create or replace function public.admin_cancel_guest_invitation(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  inv public.guest_invitations;
begin
  perform private.require(public.is_admin());
  perform private.expire_due(null, null);
  select * into inv from public.guest_invitations where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if inv.status <> 'sent' then raise exception 'not_cancellable' using errcode = 'P0001'; end if;
  update public.guest_invitations set status = 'cancelled', cancelled_at = now(), pass_returned = true where id = p_id;
  perform private.log_event(p_id, 'gift_cancelled');
  perform private.audit('invitation.cancelled', 'guest_invitation', p_id, '{}'::jsonb);
  return private.admin_invitation_row((select i from public.guest_invitations i where id = p_id));
end;
$$;

-- Members: safe fields only (no phone, no ids beyond the row key).
create or replace function public.admin_list_members(p_search text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require(public.is_admin());
  return coalesce((
    select jsonb_agg(row order by row ->> 'last_name', row ->> 'first_name')
    from (
      select jsonb_build_object(
        'id', p.id,
        'first_name', p.first_name,
        'last_name', p.last_name,
        'plan_name', m.plan_name,
        'membership_status', m.status,
        'starts_on', m.starts_on,
        'ends_on', m.ends_on,
        'allowance', coalesce(b.allowance, private.setting_int('guest_pass.default_allowance', 3)),
        'available', case when b.member_id is null then private.setting_int('guest_pass.default_allowance', 3)
                          else private.available_passes(p.id) end,
        'invitations', (select count(*) from public.guest_invitations i where i.inviter_id = p.id)
      ) as row
      from public.profiles p
      left join lateral (
        select * from public.memberships mm where mm.profile_id = p.id order by mm.starts_on desc limit 1
      ) m on true
      left join public.guest_pass_balances b on b.member_id = p.id
      where p.kind = 'member'
        and (p_search is null or p_search = '' or concat_ws(' ', p.first_name, p.last_name) ilike '%' || p_search || '%')
    ) t
  ), '[]'::jsonb);
end;
$$;

-- Reception stations (no hashes). Admin + reception can see the list.
create or replace function public.admin_list_reception_stations()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require(public.can_view_guest_passes());
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'active', s.active, 'created_at', s.created_at, 'last_rotated_at', s.last_rotated_at,
      'redemptions', (select count(*) from public.guest_redemptions r where r.reception_station_id = s.id),
      'last_redeemed_at', (select max(redeemed_at) from public.guest_redemptions r where r.reception_station_id = s.id)
    ) order by s.created_at)
    from public.reception_stations s
  ), '[]'::jsonb);
end;
$$;

-- Admin-only station operations. Create/rotate return the QR payload ONCE.
create or replace function public.admin_create_reception_station(p_name text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require(public.is_admin());
  if nullif(trim(p_name), '') is null or char_length(trim(p_name)) > 80 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  return public.create_reception_station(trim(p_name));
end;
$$;

create or replace function public.admin_rotate_reception_station(p_station_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require(public.is_admin());
  return public.rotate_reception_station_token(p_station_id);
end;
$$;

create or replace function public.admin_set_reception_station_active(p_station_id uuid, p_active boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require(public.is_admin());
  perform public.set_reception_station_active(p_station_id, p_active);
end;
$$;

-- Audit trail with the actor's display name / email.
create or replace function public.admin_list_audit_log(p_limit int default 100, p_entity_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require(public.is_admin());
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id, 'action', l.action, 'entity_type', l.entity_type, 'entity_id', l.entity_id, 'summary', l.summary,
      'actor', coalesce(a.display_name, u.email, l.actor_role), 'actor_role', l.actor_role, 'created_at', l.created_at
    ) order by l.created_at desc, l.id desc)
    from (
      select * from public.admin_audit_log
      where p_entity_id is null or entity_id = p_entity_id
      order by created_at desc, id desc
      limit least(greatest(coalesce(p_limit, 100), 1), 500)
    ) l
    left join public.admin_users a on a.user_id = l.actor_id
    left join auth.users u on u.id = l.actor_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function
  public.current_staff_role(), public.can_manage_content(), public.can_view_guest_passes(),
  public.admin_whoami(), public.admin_dashboard_stats(), public.admin_duplicate_session(uuid, date[]),
  public.admin_set_coach_activities(uuid, uuid[]), public.admin_list_guest_invitations(text, text, int),
  public.admin_guest_invitation_detail(uuid), public.admin_cancel_guest_invitation(uuid),
  public.admin_list_members(text), public.admin_list_reception_stations(),
  public.admin_create_reception_station(text), public.admin_rotate_reception_station(uuid),
  public.admin_set_reception_station_active(uuid, boolean), public.admin_list_audit_log(int, uuid)
from public, anon;
grant execute on function
  public.current_staff_role(), public.can_manage_content(), public.can_view_guest_passes(),
  public.admin_whoami(), public.admin_dashboard_stats(), public.admin_duplicate_session(uuid, date[]),
  public.admin_set_coach_activities(uuid, uuid[]), public.admin_list_guest_invitations(text, text, int),
  public.admin_guest_invitation_detail(uuid), public.admin_cancel_guest_invitation(uuid),
  public.admin_list_members(text), public.admin_list_reception_stations(),
  public.admin_create_reception_station(text), public.admin_rotate_reception_station(uuid),
  public.admin_set_reception_station_active(uuid, boolean), public.admin_list_audit_log(int, uuid)
to authenticated;
-- RLS helpers are also used by anon-visible policies.
grant execute on function public.can_manage_content(), public.can_view_guest_passes() to anon;
