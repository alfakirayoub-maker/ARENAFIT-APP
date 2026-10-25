-- =============================================================================
-- Controlled club clock
--
-- Morocco moved to permanent UTC+0 on 2026-09-20. Database/device tz data can
-- lag behind such changes, so instants for club-local wall-clock times are
-- resolved from this controlled table instead of the server's tz database.
-- The mobile app mirrors it in apps/mobile/src/lib/club-clock.ts (kept in sync
-- by apps/mobile/tests/club-clock.test.ts).
--
-- Planning stays wall-clock (session_date + start_time/end_time); this is only
-- used where a real instant is required (reminders, push scheduling).
-- =============================================================================

create table public.club_utc_offsets (
  effective_from timestamptz primary key,   -- '-infinity' = since forever
  utc_offset_minutes smallint not null check (utc_offset_minutes between -720 and 840),
  note text,
  created_at timestamptz not null default now()
);

comment on table public.club_utc_offsets is
  'Club (Africa/Casablanca) UTC offsets. Source: IANA tzdata 2026e. Append rows via migrations only.';

insert into public.club_utc_offsets (effective_from, utc_offset_minutes, note) values
  ('-infinity',             60, 'Earlier history not modelled (+01 assumed)'),
  ('2024-03-10 02:00:00+00', 0, 'Ramadan 2024'),
  ('2024-04-14 02:00:00+00', 60, null),
  ('2025-02-23 02:00:00+00', 0, 'Ramadan 2025'),
  ('2025-04-06 02:00:00+00', 60, null),
  ('2026-02-15 02:00:00+00', 0, 'Ramadan 2026'),
  ('2026-03-22 02:00:00+00', 60, null),
  ('2026-09-20 01:00:00+00', 0, 'Permanent UTC+0');

alter table public.club_utc_offsets enable row level security;

-- Reference data: readable by everyone, written only by migrations
-- (no insert/update/delete policies, even for admins).
create policy "club_utc_offsets: public read" on public.club_utc_offsets
  for select to anon, authenticated using (true);

-- Offset (minutes) in force at an instant.
create or replace function public.club_offset_minutes_at(t timestamptz)
returns integer
language sql
stable
set search_path = ''
as $$
  select o.utc_offset_minutes
  from public.club_utc_offsets o
  where o.effective_from <= t
  order by o.effective_from desc
  limit 1
$$;

-- Instant of a club-local date + time.
--   ambiguous (clocks went back): earliest instant
--   non-existent (clocks went forward): shifted forward by the gap
create or replace function public.club_instant(d date, t time)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  with wall as (
    select ((d + t) at time zone 'UTC') as w   -- wall-clock read as if it were UTC
  ),
  candidates as (
    select wall.w - make_interval(mins => o.off) as instant
    from wall,
         (select distinct utc_offset_minutes as off from public.club_utc_offsets) o
    where public.club_offset_minutes_at(wall.w - make_interval(mins => o.off)) = o.off
  )
  select coalesce(
    (select min(instant) from candidates),
    (select wall.w - make_interval(mins => public.club_offset_minutes_at(wall.w - interval '1 day')) from wall)
  )
$$;

-- Club-local wall clock at an instant (e.g. "now" at the club).
create or replace function public.club_local_timestamp(i timestamptz)
returns timestamp
language sql
stable
set search_path = ''
as $$
  select (i at time zone 'UTC') + make_interval(mins => public.club_offset_minutes_at(i))
$$;

-- Session computed fields now use the controlled clock (signatures unchanged,
-- still exposed by PostgREST as `starts_at` / `ends_at`).
create or replace function public.starts_at(s public.class_sessions)
returns timestamptz
language sql
stable
set search_path = ''
as $$ select public.club_instant(s.session_date, s.start_time) $$;

create or replace function public.ends_at(s public.class_sessions)
returns timestamptz
language sql
stable
set search_path = ''
as $$ select public.club_instant(s.session_date, s.end_time) $$;
