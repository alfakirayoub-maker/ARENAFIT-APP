-- =============================================================================
-- Arena Fit — DEVELOPMENT / DEMO fixtures. NOT ARENA FIT FACTS.
--
-- Mock rooms and a mock weekly schedule so the app has something realistic to
-- display locally. Only real coach ↔ class pairings are used, but days, times,
-- rooms and levels are invented. Run after supabase/seed.sql, local only:
--
--   psql "$DATABASE_URL" -f supabase/fixtures/dev.sql
-- =============================================================================

insert into public.rooms (name, sort_order) values
  ('[DEMO] Studio Cycling', 1),
  ('[DEMO] Studio Fitness', 2),
  ('[DEMO] Studio Combat', 3),
  ('[DEMO] Studio Mind & Body', 4)
on conflict (name) do nothing;

-- One mock week starting on the current Monday (club-local), repeated for the
-- following week.
with week as (
  select (date_trunc('week', (now() at time zone public.club_time_zone()))::date + o) as monday
  from (values (0), (7)) as w(o)
),
slots(day_offset, start_time, end_time, activity_slug, coach_slug, room, level) as (
  values
    (0, time '07:00', time '07:45', 'rpm',              'anas-d',   'Studio Cycling',    'all_levels'),
    (0, time '12:30', time '13:15', 'body-pump',        'anas-l',   'Studio Fitness',    'all_levels'),
    (0, time '18:00', time '19:00', 'rpm',              'anas-d',   'Studio Cycling',    'all_levels'),
    (0, time '19:15', time '20:15', 'body-combat',      'abdellah', 'Studio Combat',     'intermediate'),
    (1, time '09:00', time '09:45', 'mobility',         'hamza',    'Studio Mind & Body','all_levels'),
    (1, time '18:30', time '19:30', 'body-pump',        'yousra',   'Studio Fitness',    'all_levels'),
    (1, time '19:45', time '20:30', 'arenas-synergy',   'ali',      'Studio Fitness',    'intermediate'),
    (2, time '07:00', time '07:30', 'sprint',           'hamza',    'Studio Cycling',    'advanced'),
    (2, time '18:00', time '19:00', 'body-attack',      'badr',     'Studio Fitness',    'intermediate'),
    (2, time '19:15', time '20:00', 'rpm-mixte',        'anas-d',   'Studio Cycling',    'all_levels'),
    (3, time '12:30', time '13:00', 'core',             'anas-l',   'Studio Fitness',    'all_levels'),
    (3, time '18:30', time '19:30', 'body-combat',      'hamza',    'Studio Combat',     'all_levels'),
    (3, time '19:45', time '20:30', 'arena-500',        'ali',      'Studio Fitness',    'advanced'),
    (4, time '18:00', time '18:45', 'cardio-mix',       'abdellah', 'Studio Fitness',    'all_levels'),
    (4, time '19:00', time '19:45', 'rpm',              'badr',     'Studio Cycling',    'all_levels'),
    (5, time '10:00', time '11:00', 'body-pump',        'ali',      'Studio Fitness',    'all_levels'),
    (5, time '11:15', time '12:15', 'biking-adventure', 'hamza',    'Studio Cycling',    'all_levels'),
    (6, time '10:30', time '11:15', 'stretching',       'hamza',    'Studio Mind & Body','beginner'),
    (6, time '17:00', time '18:00', 'body-pump',        'badr',     'Studio Fitness',    'all_levels'),
    (6, time '18:30', time '19:15', 'rpm',              'hamza',    'Studio Cycling',    'all_levels'),
    (6, time '19:30', time '20:15', 'core-mobility',    'hamza',    'Studio Mind & Body','all_levels')
)
insert into public.class_sessions (activity_id, coach_id, room_id, session_date, start_time, end_time, level)
select a.id, c.id, r.id, w.monday + s.day_offset, s.start_time, s.end_time, s.level::public.class_level
from week w
cross join slots s
join public.activities a on a.slug = s.activity_slug
join public.coaches c on c.slug = s.coach_slug
join public.coach_activities ca on ca.coach_id = c.id and ca.activity_id = a.id  -- real pairings only
join public.rooms r on r.name = '[DEMO] ' || s.room;
