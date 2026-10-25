-- =============================================================================
-- Arena Fit — DEVELOPMENT / DEMO fixtures. NOT ARENA FIT FACTS.
--
-- Mock rooms, a mock weekly schedule, activity details and news so the app has something realistic to
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

-- Mock activity details (descriptions, durations, intensity…). Club-specific
-- formats deliberately stay NULL so the apps are exercised with missing data.
update public.activities a set
  short_description = m.short_description,
  description = m.description,
  intensity = m.intensity,
  equipment = m.equipment,
  target_muscles = m.target_muscles,
  recommended_for = m.recommended_for,
  default_duration_min = m.duration,
  is_featured = m.featured
from (values
  ('body-pump', 'Renforcement musculaire avec barre et poids, en musique.',
   'Un entraînement complet avec barre et disques : des répétitions nombreuses à charge légère à modérée pour tonifier tout le corps. Vous choisissez votre charge, le coach donne le rythme.',
   3, array['Barre', 'Disques', 'Step'], array['Corps entier'], 'Tous les membres souhaitant se renforcer', 60, true),
  ('rpm', 'Cardio sur vélo indoor, rythmé par la musique.',
   'Un parcours sur vélo indoor alternant montées, sprints et récupérations. Vous contrôlez la résistance : idéal pour progresser en endurance à votre niveau.',
   4, array['Vélo indoor'], array['Jambes', 'Fessiers', 'Cardio'], 'Tous niveaux, résistance ajustable', 45, true),
  ('body-combat', 'Cardio inspiré des arts martiaux, sans contact.',
   'Coups de poing, coups de pied et katas inspirés de la boxe, du karaté et du taekwondo. Un défoulement cardio intense, sans contact ni matériel.',
   4, array[]::text[], array['Cardio', 'Abdominaux', 'Épaules'], 'Celles et ceux qui veulent se dépasser', 55, true),
  ('body-attack', 'Cardio athlétique et renforcement.',
   'Un mélange de mouvements athlétiques, de sauts et d’exercices de renforcement pour un cardio complet.',
   5, array[]::text[], array['Cardio', 'Jambes'], null, 55, false),
  ('arenas-synergy', null, null, null, array[]::text[], array[]::text[], null, null, true),
  ('sprint', 'HIIT court et intense sur vélo.',
   'Des efforts très courts à haute intensité sur vélo, entrecoupés de récupérations. Court, mais exigeant.',
   5, array['Vélo indoor'], array[]::text[], null, 30, false),
  ('core', 'Gainage et sangle abdominale.',
   'Un format court pour renforcer la sangle abdominale, le dos et la stabilité.',
   3, array[]::text[], array['Abdominaux', 'Dos'], null, 30, false),
  ('mobility', 'Amplitude articulaire et récupération.',
   'Des exercices guidés pour gagner en amplitude, prévenir les blessures et mieux récupérer.',
   1, array[]::text[], array[]::text[], 'Tous, en complément des cours intenses', 45, false),
  ('stretching', 'Étirements doux et relâchement.',
   'Une séance calme d’étirements pour relâcher les tensions et améliorer la souplesse.',
   1, array[]::text[], array[]::text[], null, 45, false)
) as m(slug, short_description, description, intensity, equipment, target_muscles, recommended_for, duration, featured)
where a.slug = m.slug;

-- Mock news.
insert into public.news (slug, category, title, excerpt, body, status, published_at) values
  ('planning-semaine', 'schedule', 'Le planning de la semaine est en ligne',
   'Retrouvez tous les cours collectifs et activez vos rappels en un geste.',
   E'Le planning des cours collectifs est disponible dans l’onglet Planning.\n\nAppuyez sur la cloche d’un cours pour recevoir un rappel avant qu’il ne commence. Un rappel n’est pas une réservation.',
   'published', now() - interval '1 day'),
  ('challenge-novembre', 'challenge', 'Challenge du mois : 12 cours en 4 semaines',
   'Relevez le défi et partagez votre progression avec l’équipe des coachs.',
   E'Ce mois-ci, nous vous proposons de suivre 12 cours collectifs en 4 semaines.\n\nChoisissez les formats qui vous plaisent et parlez-en à vos coachs en salle.',
   'published', now() - interval '3 days'),
  ('recuperation-mobility', 'wellness', 'Récupérer mieux grâce aux cours Mobility',
   'Pourquoi intégrer une séance douce à votre semaine d’entraînement.',
   E'Les séances de mobilité et d’étirements aident à garder de l’amplitude et à récupérer entre deux séances intenses.\n\nUne séance par semaine suffit pour en ressentir les bénéfices.',
   'published', now() - interval '6 days'),
  ('evenement-portes-ouvertes', 'event', 'Journée découverte au club',
   'Invitez vos proches à découvrir les cours collectifs avec un Pass Invité.',
   E'Profitez de vos Pass Invité pour faire découvrir Arena Fit à vos proches.\n\nDepuis l’onglet Profil, ouvrez Pass & Invitations et partagez votre invitation.',
   'published', now() - interval '10 days'),
  ('brouillon-demo', 'offer', 'Brouillon (ne doit pas apparaître)', 'Article non publié.', 'Brouillon.', 'draft', null)
on conflict (slug) do nothing;
