-- =============================================================================
-- Arena Fit — reference seed data
--
-- Coaches and their classes come from the official Arena Fit roster. Do not add
-- coaches here: new coaches are created from the admin dashboard.
-- Rooms other than 'Studio Cycling' are placeholders to confirm with the club.
-- =============================================================================

insert into public.app_settings (key, value, is_public, description) values
  ('club.timezone', '"Africa/Casablanca"', true, 'IANA timezone used to display the planning'),
  ('guest_pass.default_allowance', '3', false, 'Guest passes granted to a new member'),
  ('guest_pass.link_validity_days', '14', false, 'Days an invitation link stays activatable'),
  ('guest_pass.pass_validity_days', '30', false, 'Days a guest pass stays valid once activated'),
  ('guest_pass.sessions_per_pass', '1', true, 'Sessions offered by one guest pass'),
  ('guest_pass.refund_expired_unactivated', 'true', false, 'Give the pass back when an invitation expires unused')
on conflict (key) do nothing;

insert into public.rooms (name, sort_order) values
  ('Studio Cycling', 1),
  ('Studio Fitness', 2),   -- placeholder, confirm with club
  ('Studio Combat', 3),    -- placeholder, confirm with club
  ('Studio Mind & Body', 4) -- placeholder, confirm with club
on conflict (name) do nothing;

-- default_duration_min values are starting defaults; each session sets its own times.
insert into public.activities (slug, name, category, default_duration_min, is_featured, sort_order) values
  ('body-pump',          'Body Pump',          'fitness',   60, true,  1),
  ('rpm',                'RPM',                'cycling',   45, true,  2),
  ('body-combat',        'Body Combat',        'combat',    55, true,  3),
  ('body-attack',        'Body Attack',        'fitness',   55, false, 4),
  ('arenas-synergy',     'Arena''s Synergy',   'fitness',   45, true,  5),
  ('arena-500',          'Arena 500',          'fitness',   45, false, 6),
  ('sprint',             'Sprint',             'cycling',   30, false, 7),
  ('sprint-core',        'Sprint-Core',        'cycling',   45, false, 8),
  ('core',               'Core',               'fitness',   30, false, 9),
  ('core-mobility',      'Core / Mobility',    'mind_body', 45, false, 10),
  ('mobility',           'Mobility',           'mind_body', 45, false, 11),
  ('stretching',         'Stretching',         'mind_body', 45, false, 12),
  ('full-legs',          'Full Legs',          'fitness',   45, false, 13),
  ('grit-force',         'Grit Force',         'fitness',   30, false, 14),
  ('rpm-mixte',          'RPM Mixte',          'cycling',   45, false, 15),
  ('circuit-training',   'Circuit Training',   'fitness',   45, false, 16),
  ('fitness-challenge',  'Fitness Challenge',  'fitness',   45, false, 17),
  ('cardio-mix',         'Cardio Mix',         'fitness',   45, false, 18),
  ('biking-adventure',   'Biking Adventure',   'cycling',   60, false, 19)
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
