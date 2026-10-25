-- =============================================================================
-- Arena Fit — PRODUCTION reference seed
--
-- Only facts supplied by Arena Fit belong here:
--   * the coach roster and each coach's classes,
--   * the club timezone,
--   * the initial guest-pass allowance (3, from the product brief).
--
-- Unknown attributes (durations, rooms, images, descriptions, intensity…) stay
-- NULL / empty and are filled from the admin dashboard. Mock data for local
-- development lives in supabase/fixtures/dev.sql — never in this file.
-- =============================================================================

insert into public.app_settings (key, value, is_public, description) values
  ('club.timezone', '"Africa/Casablanca"', true, 'IANA timezone of the club; planning times are local to it'),
  ('guest_pass.default_allowance', '3', false, 'Guest passes granted to a new member')
on conflict (key) do nothing;

-- Category is required for the planning filters. Les Mills formats map
-- unambiguously (RPM/Sprint → Cycling, Body Combat → Combat, Body Pump/Attack
-- → Fitness). REVIEW WITH CLUB: the category of club-specific formats
-- (Arena's Synergy, Arena 500, Grit Force, Full Legs, Circuit Training,
-- Fitness Challenge, Cardio Mix, Core, Biking Adventure, Mobility, Stretching,
-- Core / Mobility) is inferred from the class name.
insert into public.activities (slug, name, category, sort_order) values
  ('body-pump',         'Body Pump',         'fitness',   1),
  ('rpm',               'RPM',               'cycling',   2),
  ('body-combat',       'Body Combat',       'combat',    3),
  ('body-attack',       'Body Attack',       'fitness',   4),
  ('arenas-synergy',    'Arena''s Synergy',  'fitness',   5),
  ('arena-500',         'Arena 500',         'fitness',   6),
  ('sprint',            'Sprint',            'cycling',   7),
  ('sprint-core',       'Sprint-Core',       'cycling',   8),
  ('core',              'Core',              'fitness',   9),
  ('core-mobility',     'Core / Mobility',   'mind_body', 10),
  ('mobility',          'Mobility',          'mind_body', 11),
  ('stretching',        'Stretching',        'mind_body', 12),
  ('full-legs',         'Full Legs',         'fitness',   13),
  ('grit-force',        'Grit Force',        'fitness',   14),
  ('rpm-mixte',         'RPM Mixte',         'cycling',   15),
  ('circuit-training',  'Circuit Training',  'fitness',   16),
  ('fitness-challenge', 'Fitness Challenge', 'fitness',   17),
  ('cardio-mix',        'Cardio Mix',        'fitness',   18),
  ('biking-adventure',  'Biking Adventure',  'cycling',   19)
on conflict (slug) do nothing;

insert into public.coaches (slug, display_name, sort_order) values
  ('anas-l',   'ANAS L',   1),
  ('anas-d',   'ANAS D',   2),
  ('abdellah', 'ABDELLAH', 3),
  ('badr',     'BADR',     4),
  ('hamza',    'HAMZA',    5),
  ('ali',      'ALI',      6),
  ('yousra',   'YOUSRA',   7)
on conflict (slug) do nothing;

insert into public.coach_activities (coach_id, activity_id)
select c.id, a.id
from (values
  ('anas-l', 'body-pump'), ('anas-l', 'full-legs'), ('anas-l', 'core'), ('anas-l', 'grit-force'),
  ('anas-d', 'rpm-mixte'), ('anas-d', 'circuit-training'), ('anas-d', 'fitness-challenge'), ('anas-d', 'rpm'),
  ('abdellah', 'cardio-mix'), ('abdellah', 'body-pump'), ('abdellah', 'body-attack'), ('abdellah', 'body-combat'),
  ('badr', 'rpm'), ('badr', 'body-pump'), ('badr', 'body-attack'), ('badr', 'body-combat'),
  ('hamza', 'stretching'), ('hamza', 'mobility'), ('hamza', 'core-mobility'), ('hamza', 'sprint'),
  ('hamza', 'sprint-core'), ('hamza', 'biking-adventure'), ('hamza', 'body-combat'), ('hamza', 'rpm'),
  ('ali', 'arenas-synergy'), ('ali', 'body-pump'), ('ali', 'arena-500'),
  ('yousra', 'body-pump')
) as m(coach_slug, activity_slug)
join public.coaches c on c.slug = m.coach_slug
join public.activities a on a.slug = m.activity_slug
on conflict do nothing;
