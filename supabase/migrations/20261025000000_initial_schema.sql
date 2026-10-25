-- =============================================================================
-- Arena Fit — initial data model
--
-- Conventions
--   * Audit timestamps (created_at, redeemed_at…) are timestamptz.
--   * The planning is club-local wall-clock time (date + time, Africa/Casablanca).
--     A class "at 18:00" stays at 18:00 across Morocco's DST / Ramadan offset
--     changes; absolute instants are derived with club_instant() when needed
--     (reminders, push scheduling).
--   * Every table has created_at / updated_at (updated_at maintained by trigger).
--   * Secrets (invitation link tokens, reception station tokens) are NEVER stored in clear:
--     only their SHA-256 hash. The raw token is returned once by an RPC.
--   * Content that may need translation (activities, news, coaches) keeps the
--     French source in typed columns and optional translations in `i18n` jsonb:
--       { "ar": { "name": "...", "description": "..." }, "en": { ... } }
--   * Writes to guest-pass tables happen only through SECURITY DEFINER RPCs
--     (added in the Sprint 5/6 migrations), never directly from clients.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

create type public.profile_kind as enum ('guest', 'member');
create type public.staff_role as enum ('admin', 'reception');
create type public.membership_status as enum ('active', 'expired', 'suspended');

create type public.activity_category as enum (
  'fitness', 'combat', 'dance', 'aqua', 'kids', 'cycling', 'mind_body'
);
create type public.class_level as enum ('all_levels', 'beginner', 'intermediate', 'advanced');
create type public.session_visibility as enum ('public', 'members', 'hidden');

create type public.news_category as enum (
  'announcement', 'equipment', 'offer', 'event', 'kids',
  'challenge', 'schedule', 'wellness'
);
create type public.publish_status as enum ('draft', 'published');

create type public.notification_category as enum (
  'announcement', 'schedule_change', 'club_news', 'event'
);
create type public.notification_audience as enum (
  'all', 'activity_preference', 'membership_type', 'specific_users'
);
create type public.notification_status as enum ('draft', 'scheduled', 'sent', 'failed');

-- 'available' is intentionally not a stored status: availability is the
-- member's allowance minus the invitations that consume it (see view below).
create type public.guest_invitation_status as enum (
  'sent', 'activated', 'used', 'expired', 'cancelled', 'converted'
);

create type public.device_platform as enum ('ios', 'android', 'web');

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Identity: profiles, staff
-- -----------------------------------------------------------------------------

-- One row per auth user. Browsing the app needs no account: a Supabase user
-- is created only when an identity is actually needed — activating a guest
-- pass (kind = 'guest') or member sign-in (kind = 'member').
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  kind public.profile_kind not null default 'guest',
  first_name text,
  last_name text,
  phone text,
  avatar_path text,
  locale text not null default 'fr' check (locale in ('fr', 'ar', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.staff_role not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Reception staff or admins: allowed to check and redeem guest passes.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and kind = 'member'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.notification_preferences (profile_id) values (new.id)
    on conflict (profile_id) do nothing;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Memberships (managed by admins; the app has no payment / access control)
-- -----------------------------------------------------------------------------

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  plan_name text not null,                 -- e.g. 'Arena Premium'
  membership_type text not null,           -- free-form key used for targeting
  status public.membership_status not null default 'active',
  starts_on date not null,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
create index memberships_profile_idx on public.memberships (profile_id);
create index memberships_type_idx on public.memberships (membership_type) where status = 'active';

-- -----------------------------------------------------------------------------
-- Catalogue: coaches, activities, rooms
-- -----------------------------------------------------------------------------

create table public.coaches (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,              -- e.g. 'ANAS D'
  bio text,
  photo_path text,                         -- storage: coaches/<file>
  is_active boolean not null default true,
  sort_order int not null default 0,
  i18n jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category public.activity_category not null,
  short_description text,
  description text,
  intensity smallint check (intensity between 1 and 5),
  equipment text[] not null default '{}',
  target_muscles text[] not null default '{}',
  recommended_for text,
  default_duration_min smallint check (default_duration_min > 0),
  image_path text,                         -- storage: activities/<file>
  is_featured boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  i18n jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activities_category_idx on public.activities (category) where is_active;

create table public.coach_activities (
  coach_id uuid not null references public.coaches (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (coach_id, activity_id)
);
create index coach_activities_activity_idx on public.coach_activities (activity_id);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,               -- e.g. 'Studio Cycling'
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Planning
-- -----------------------------------------------------------------------------

-- The club's timezone. Planning times are wall-clock times in this zone.
create or replace function public.club_time_zone()
returns text
language sql
immutable
as $$ select 'Africa/Casablanca' $$;

-- Absolute instant of a club-local date + time, using the tz database's
-- current rules for Morocco (incl. the Ramadan switch to UTC+0).
create or replace function public.club_instant(d date, t time)
returns timestamptz
language sql
stable
as $$ select (d + t) at time zone public.club_time_zone() $$;

-- Concrete, dated sessions in club-local time (no recurrence rules in the
-- MVP — the admin duplicates sessions / weeks instead). Classes never span
-- midnight. There is no booking: a session is information only.
create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete restrict,
  coach_id uuid references public.coaches (id) on delete set null,
  room_id uuid references public.rooms (id) on delete set null,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  level public.class_level not null default 'all_levels',
  description text,                        -- overrides activity description
  visibility public.session_visibility not null default 'public',
  is_cancelled boolean not null default false,
  cancellation_note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index class_sessions_date_idx on public.class_sessions (session_date, start_time)
  where visibility <> 'hidden';
create index class_sessions_activity_idx on public.class_sessions (activity_id, session_date);
create index class_sessions_coach_idx on public.class_sessions (coach_id, session_date);

-- Computed fields (PostgREST exposes them as `starts_at` / `ends_at`).
create or replace function public.starts_at(s public.class_sessions)
returns timestamptz
language sql
stable
as $$ select public.club_instant(s.session_date, s.start_time) $$;

create or replace function public.ends_at(s public.class_sessions)
returns timestamptz
language sql
stable
as $$ select public.club_instant(s.session_date, s.end_time) $$;

-- -----------------------------------------------------------------------------
-- Member preferences
-- -----------------------------------------------------------------------------

create table public.favorite_activities (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, activity_id)
);
create index favorite_activities_activity_idx on public.favorite_activities (activity_id);

-- "Me le rappeler". The local notification is scheduled on the device; this
-- row lets the backend re-notify people when a session they follow changes.
-- This is NOT a reservation.
create table public.class_reminders (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.class_sessions (id) on delete cascade,
  offset_minutes smallint not null check (offset_minutes in (15, 30, 60, 120)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, session_id)
);
create index class_reminders_session_idx on public.class_reminders (session_id);

create table public.notification_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  class_reminders boolean not null default true,
  schedule_changes boolean not null default true,
  club_news boolean not null default true,
  events boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null unique,
  platform public.device_platform not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index device_tokens_profile_idx on public.device_tokens (profile_id);

-- -----------------------------------------------------------------------------
-- News & notifications
-- -----------------------------------------------------------------------------

create table public.news (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category public.news_category not null,
  title text not null,
  excerpt text not null,
  body text not null,
  cover_path text,                         -- storage: news/<file>
  status public.publish_status not null default 'draft',
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  i18n jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'draft' or published_at is not null)
);
create index news_published_idx on public.news (published_at desc) where status = 'published';

-- Admin-composed push campaigns. Targeting is deliberately simple (MVP).
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  category public.notification_category not null,
  title text not null,
  body text not null,
  deep_link text,                          -- e.g. 'arenafit://news/<slug>'
  audience public.notification_audience not null default 'all',
  audience_activity_ids uuid[] not null default '{}',
  audience_membership_types text[] not null default '{}',
  audience_profile_ids uuid[] not null default '{}',
  status public.notification_status not null default 'draft',
  scheduled_for timestamptz,
  sent_at timestamptz,
  recipient_count int,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_status_idx on public.notifications (status, scheduled_for);

-- -----------------------------------------------------------------------------
-- Settings
-- -----------------------------------------------------------------------------

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,  -- readable by the apps
  description text,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Guest passes
--
--   balance (allowance)  ──<  invitation (share link)  ──1:1──  pass  ──1:1── redemption
--
-- A forwarded WhatsApp link can activate a pass once (bound to the guest
-- identity that activated it). Redemption (the guest scanning the reception
-- QR) and the reception stations are defined in the Guest Pass migration.
-- -----------------------------------------------------------------------------

create table public.guest_pass_balances (
  member_id uuid primary key references public.profiles (id) on delete cascade,
  allowance int not null check (allowance >= 0),   -- total passes granted
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.guest_invitations (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invitee_name text,
  link_token_hash bytea not null unique,
  status public.guest_invitation_status not null default 'sent',
  link_expires_at timestamptz not null,
  guest_profile_id uuid references public.profiles (id) on delete set null,
  activated_at timestamptz,
  cancelled_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guest_invitations_inviter_idx on public.guest_invitations (inviter_id, created_at desc);
create index guest_invitations_guest_idx on public.guest_invitations (guest_profile_id);
create index guest_invitations_status_idx on public.guest_invitations (status);

create table public.guest_passes (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.guest_invitations (id) on delete cascade,
  guest_profile_id uuid not null references public.profiles (id) on delete cascade,
  sessions_allowed smallint not null default 1 check (sessions_allowed > 0),
  valid_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guest_passes_guest_idx on public.guest_passes (guest_profile_id);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'admin_users', 'memberships', 'coaches', 'activities', 'rooms',
    'class_sessions', 'class_reminders', 'notification_preferences', 'device_tokens',
    'news', 'notifications', 'guest_pass_balances', 'guest_invitations',
    'guest_passes', 'app_settings'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.memberships enable row level security;
alter table public.coaches enable row level security;
alter table public.activities enable row level security;
alter table public.coach_activities enable row level security;
alter table public.rooms enable row level security;
alter table public.class_sessions enable row level security;
alter table public.favorite_activities enable row level security;
alter table public.class_reminders enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.device_tokens enable row level security;
alter table public.news enable row level security;
alter table public.notifications enable row level security;
alter table public.guest_pass_balances enable row level security;
alter table public.guest_invitations enable row level security;
alter table public.guest_passes enable row level security;
alter table public.app_settings enable row level security;

-- Profiles: own row only; admins read/manage all. Users may only edit
-- personal fields (kind is changed by RPCs / admins).
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_staff());
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles: admin all" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke update on public.profiles from authenticated;
grant update (first_name, last_name, phone, avatar_path, locale) on public.profiles to authenticated;

create policy "admin_users: read own" on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "admin_users: admin all" on public.admin_users
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "memberships: read own" on public.memberships
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "memberships: admin all" on public.memberships
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Public catalogue: readable without login.
create policy "coaches: public read" on public.coaches
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "coaches: admin all" on public.coaches
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "activities: public read" on public.activities
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "activities: admin all" on public.activities
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "coach_activities: public read" on public.coach_activities
  for select to anon, authenticated using (true);
create policy "coach_activities: admin all" on public.coach_activities
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "rooms: public read" on public.rooms
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "rooms: admin all" on public.rooms
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "class_sessions: read visible" on public.class_sessions
  for select to anon, authenticated using (
    visibility = 'public'
    or (visibility = 'members' and public.is_member())
    or public.is_admin()
  );
create policy "class_sessions: admin all" on public.class_sessions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Personal preference tables: owner only.
create policy "favorite_activities: own" on public.favorite_activities
  for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "class_reminders: own" on public.class_reminders
  for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "notification_preferences: own" on public.notification_preferences
  for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "device_tokens: own" on public.device_tokens
  for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

create policy "news: read published" on public.news
  for select to anon, authenticated using (
    (status = 'published' and published_at <= now()) or public.is_admin()
  );
create policy "news: admin all" on public.news
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "notifications: admin all" on public.notifications
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Guest passes: read-only for the people involved; all writes go through RPCs.
create policy "guest_pass_balances: read own" on public.guest_pass_balances
  for select to authenticated using (member_id = (select auth.uid()) or public.is_admin());
create policy "guest_pass_balances: admin all" on public.guest_pass_balances
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "guest_invitations: read involved" on public.guest_invitations
  for select to authenticated using (
    inviter_id = (select auth.uid())
    or guest_profile_id = (select auth.uid())
    or public.is_staff()
  );

create policy "guest_passes: read own" on public.guest_passes
  for select to authenticated using (guest_profile_id = (select auth.uid()) or public.is_staff());

create policy "app_settings: read public" on public.app_settings
  for select to anon, authenticated using (is_public or public.is_admin());
create policy "app_settings: admin all" on public.app_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Storage buckets (public-read content, admin-write; avatars are per-user)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('coaches', 'coaches', true),
  ('activities', 'activities', true),
  ('news', 'news', true),
  ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy "content buckets: admin write" on storage.objects
  for all to authenticated
  using (bucket_id in ('coaches', 'activities', 'news') and public.is_admin())
  with check (bucket_id in ('coaches', 'activities', 'news') and public.is_admin());

-- avatars/<user id>/<file>
create policy "avatars: own folder" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
