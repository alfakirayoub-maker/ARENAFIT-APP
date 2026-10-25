-- The production seed contains only verified Arena Fit facts.
-- Run on a database with supabase/seed.sql and WITHOUT supabase/fixtures/dev.sql.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

select results_eq(
  $$ select display_name from coaches order by sort_order $$,
  $$ values ('ANAS L'), ('ANAS D'), ('ABDELLAH'), ('BADR'), ('HAMZA'), ('ALI'), ('YOUSRA') $$,
  'exactly the real coach roster'
);

select results_eq(
  $$ select c.display_name, string_agg(a.name, ', ' order by a.name)
     from coach_activities ca join coaches c on c.id = ca.coach_id join activities a on a.id = ca.activity_id
     group by c.display_name, c.sort_order order by c.sort_order $$,
  $$ values
       ('ANAS L', 'Body Pump, Core, Full Legs, Grit Force'),
       ('ANAS D', 'Circuit Training, Fitness Challenge, RPM, RPM Mixte'),
       ('ABDELLAH', 'Body Attack, Body Combat, Body Pump, Cardio Mix'),
       ('BADR', 'Body Attack, Body Combat, Body Pump, RPM'),
       ('HAMZA', 'Biking Adventure, Body Combat, Core / Mobility, Mobility, RPM, Sprint, Sprint-Core, Stretching'),
       ('ALI', 'Arena 500, Arena''s Synergy, Body Pump'),
       ('YOUSRA', 'Body Pump') $$,
  'exactly the supplied coach ↔ class relationships'
);

select is((select count(*) from activities)::int, 19, '19 classes from the roster');
select is((select count(*) from activities where description is not null or short_description is not null
           or intensity is not null or default_duration_min is not null or image_path is not null
           or recommended_for is not null or cardinality(equipment) > 0 or cardinality(target_muscles) > 0)::int,
          0, 'no invented activity details');
select is((select count(*) from activities where is_featured)::int, 0, 'no invented featured flags');
select is((select count(*) from coaches where bio is not null or photo_path is not null)::int, 0, 'no invented coach details');
select is((select count(*) from rooms)::int, 0, 'no invented rooms');
select is((select count(*) from class_sessions)::int + (select count(*) from news)::int, 0, 'no mock sessions or news');
select is((select value from app_settings where key = 'guest_pass.default_allowance'), '3'::jsonb, 'initial allowance = 3');

select * from finish();
rollback;
