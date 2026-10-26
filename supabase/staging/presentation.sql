-- =============================================================================
-- Arena Fit — STAGING PRESENTATION DATASET (reset). NOT ARENA FIT FACTS.
--
-- Restores the stakeholder demo content on the staging project:
--   * reference data back to supabase/seed.sql (roster, classes, pairings),
--   * presentation-only content: rooms, two weeks of planning from the current
--     club week, activity descriptions, four news items,
--   * clears what a demo run leaves behind: guest passes and guest accounts,
--     audit log, notification drafts, favourites/reminders, uploaded image paths.
--
-- Accounts and the Guest Pass examples are created afterwards by
-- scripts/staging/staging.mjs (it runs this file first). Run through that
-- script, never by hand on another project.
--
-- SAFETY: refuses to run unless the database carries the staging marker
-- (app_settings 'deployment.environment' = "staging"), which only
-- `staging.mjs mark-staging` writes. Production never has it.
-- =============================================================================

-- One statement (a DO block): atomic, and runnable with `supabase db query -f`.
do $reset$
begin
if coalesce((select value #>> '{}' from public.app_settings where key = 'deployment.environment'), '') <> 'staging' then
  raise exception 'REFUSED: this database is not marked as staging (app_settings deployment.environment). Nothing was changed.';
end if;

-- --- Leftovers of previous demos ---------------------------------------------
delete from public.guest_redemptions;
delete from public.guest_pass_events;
delete from public.guest_code_attempts;
delete from public.guest_passes;
delete from public.guest_invitations;
delete from public.guest_pass_balances;
delete from auth.users where is_anonymous;          -- guest identities (profiles cascade)
delete from public.notifications;                   -- drafts only (sending is not active)
delete from public.favorite_activities;
delete from public.class_sessions;                  -- reminders cascade
delete from public.rooms;
delete from public.news;

-- --- Reference data back to the production seed ------------------------------
-- (names, categories and pairings must match supabase/seed.sql — checked by
-- supabase/tests/staging_presentation.test.sql)
update public.activities a set
  name = s.name, category = s.category::public.activity_category, sort_order = s.sort_order,
  is_active = true, is_featured = false, image_path = null,
  short_description = null, description = null, intensity = null, equipment = '{}',
  target_muscles = '{}', recommended_for = null, default_duration_min = null
from (values
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
) as s(slug, name, category, sort_order)
where a.slug = s.slug;
-- Activities created during a demo (not in the roster) are hidden, not deleted.
update public.activities set is_active = false
where slug not in ('body-pump', 'rpm', 'body-combat', 'body-attack', 'arenas-synergy', 'arena-500', 'sprint',
  'sprint-core', 'core', 'core-mobility', 'mobility', 'stretching', 'full-legs', 'grit-force', 'rpm-mixte',
  'circuit-training', 'fitness-challenge', 'cardio-mix', 'biking-adventure');

update public.coaches c set display_name = s.display_name, sort_order = s.sort_order, is_active = true,
  bio = null, photo_path = null
from (values
  ('anas-l', 'ANAS L', 1), ('anas-d', 'ANAS D', 2), ('abdellah', 'ABDELLAH', 3), ('badr', 'BADR', 4),
  ('hamza', 'HAMZA', 5), ('ali', 'ALI', 6), ('yousra', 'YOUSRA', 7)
) as s(slug, display_name, sort_order)
where c.slug = s.slug;
update public.coaches set is_active = false
where slug not in ('anas-l', 'anas-d', 'abdellah', 'badr', 'hamza', 'ali', 'yousra');

delete from public.coach_activities;
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
join public.activities a on a.slug = m.activity_slug;

-- --- Presentation content (invented for the demo, to validate with the club) --
insert into public.rooms (name, sort_order) values
  ('Studio Cycling', 1), ('Studio Fitness', 2), ('Studio Combat', 3), ('Studio Mind & Body', 4);

update public.activities a set
  short_description = m.short_description, description = m.description, intensity = m.intensity,
  equipment = m.equipment, target_muscles = m.target_muscles, recommended_for = m.recommended_for,
  default_duration_min = m.duration, is_featured = m.featured
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
  -- Club-specific formats keep no invented description (the club writes them).
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

-- Planning: the current club week and the next one (real coach ↔ class pairings only).
with week as (
  select (date_trunc('week', (now() at time zone public.club_time_zone()))::date + o) as monday
  from (values (0), (7)) as w(o)
),
slots(day_offset, start_time, end_time, activity_slug, coach_slug, room, level) as (
  values
    (0, time '07:00', time '07:45', 'rpm',              'anas-d',   'Studio Cycling',     'all_levels'),
    (0, time '12:30', time '13:30', 'body-pump',        'anas-l',   'Studio Fitness',     'all_levels'),
    (0, time '18:00', time '18:45', 'rpm',              'anas-d',   'Studio Cycling',     'all_levels'),
    (0, time '19:00', time '19:55', 'body-combat',      'abdellah', 'Studio Combat',      'intermediate'),
    (1, time '09:00', time '09:45', 'mobility',         'hamza',    'Studio Mind & Body', 'all_levels'),
    (1, time '18:30', time '19:30', 'body-pump',        'yousra',   'Studio Fitness',     'all_levels'),
    (1, time '19:45', time '20:30', 'arenas-synergy',   'ali',      'Studio Fitness',     'intermediate'),
    (2, time '07:00', time '07:30', 'sprint',           'hamza',    'Studio Cycling',     'advanced'),
    (2, time '18:00', time '18:55', 'body-attack',      'badr',     'Studio Fitness',     'intermediate'),
    (2, time '19:15', time '20:00', 'rpm-mixte',        'anas-d',   'Studio Cycling',     'all_levels'),
    (3, time '12:30', time '13:00', 'core',             'anas-l',   'Studio Fitness',     'all_levels'),
    (3, time '18:30', time '19:25', 'body-combat',      'hamza',    'Studio Combat',      'all_levels'),
    (3, time '19:45', time '20:30', 'arena-500',        'ali',      'Studio Fitness',     'advanced'),
    (4, time '18:00', time '18:45', 'cardio-mix',       'abdellah', 'Studio Fitness',     'all_levels'),
    (4, time '19:00', time '19:45', 'rpm',              'badr',     'Studio Cycling',     'all_levels'),
    (5, time '10:00', time '11:00', 'body-pump',        'ali',      'Studio Fitness',     'all_levels'),
    (5, time '11:15', time '12:15', 'biking-adventure', 'hamza',    'Studio Cycling',     'all_levels'),
    (6, time '10:30', time '11:15', 'stretching',       'hamza',    'Studio Mind & Body', 'beginner'),
    (6, time '17:00', time '18:00', 'body-pump',        'badr',     'Studio Fitness',     'all_levels'),
    (6, time '18:30', time '19:15', 'rpm',              'hamza',    'Studio Cycling',     'all_levels'),
    (6, time '19:30', time '20:15', 'core-mobility',    'hamza',    'Studio Mind & Body', 'all_levels')
)
insert into public.class_sessions (activity_id, coach_id, room_id, session_date, start_time, end_time, level)
select a.id, c.id, r.id, w.monday + s.day_offset, s.start_time, s.end_time, s.level::public.class_level
from week w
cross join slots s
join public.activities a on a.slug = s.activity_slug
join public.coaches c on c.slug = s.coach_slug
join public.coach_activities ca on ca.coach_id = c.id and ca.activity_id = a.id
join public.rooms r on r.name = s.room;

insert into public.news (slug, category, title, excerpt, body, status, published_at) values
  ('planning-semaine', 'schedule', 'Le planning de la semaine est en ligne',
   'Retrouvez tous les cours collectifs et activez vos rappels en un geste.',
   E'Le planning des cours collectifs est disponible dans l’onglet Planning.\n\nAppuyez sur la cloche d’un cours pour recevoir un rappel avant qu’il ne commence. Un rappel n’est pas une réservation.',
   'published', now() - interval '1 day'),
  ('pass-invite', 'event', 'Offrez une séance à un proche',
   'Chaque membre dispose de Pass Invité à partager depuis l’application.',
   E'Depuis l’onglet Profil, ouvrez Pass & Invitations et offrez un Pass à un proche.\n\nVotre invité active son Pass dans l’application, puis le valide à l’accueil en scannant le QR Arena Fit.',
   'published', now() - interval '3 days'),
  ('challenge-du-mois', 'challenge', 'Challenge du mois : 12 cours en 4 semaines',
   'Relevez le défi et partagez votre progression avec l’équipe des coachs.',
   E'Ce mois-ci, nous vous proposons de suivre 12 cours collectifs en 4 semaines.\n\nChoisissez les formats qui vous plaisent et parlez-en à vos coachs en salle.',
   'published', now() - interval '5 days'),
  ('recuperation-mobility', 'wellness', 'Récupérer mieux grâce aux cours Mobility',
   'Pourquoi intégrer une séance douce à votre semaine d’entraînement.',
   E'Les séances de mobilité et d’étirements aident à garder de l’amplitude et à récupérer entre deux séances intenses.\n\nUne séance par semaine suffit pour en ressentir les bénéfices.',
   'published', now() - interval '8 days');

-- Internal marker: this content is presentation data (never shown in the apps).
insert into public.app_settings (key, value, is_public, description)
values ('presentation.dataset', jsonb_build_object('reset_at', now()), false,
        'Staging presentation dataset (supabase/staging/presentation.sql) — not Arena Fit facts')
on conflict (key) do update set value = excluded.value;

-- The reset itself is not something staff did: start the journal clean.
delete from public.admin_audit_log;
end
$reset$;
