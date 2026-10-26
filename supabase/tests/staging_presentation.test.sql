-- Staging presentation reset (supabase/staging/presentation.sql): refuses any
-- database not marked as staging, restores the production seed's reference
-- data exactly, and leaves a clean presentation dataset with no leftovers.
-- The reset SQL arrives as :staging_reset (see scripts/db/test.sh).
\ir staging_reset.psql
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(17);

-- Reference data as the production seed created it.
create temp table ref_activities as select slug, name, category::text as category, sort_order from activities;
create temp table ref_coaches as select slug, display_name, sort_order from coaches;
create temp table ref_pairs as
  select c.slug as coach, a.slug as activity from coach_activities ca
  join coaches c on c.id = ca.coach_id join activities a on a.id = ca.activity_id;

select throws_ok(:'staging_reset', 'P0001', null, 'refuses a database without the staging marker');
select is((select count(*) from rooms)::int, 0, 'a refused reset changes nothing');

insert into app_settings (key, value, is_public, description)
values ('deployment.environment', '"staging"', false, 'test');

-- What a rehearsal leaves behind.
update activities set name = 'Body Pump EDIT', is_active = false, image_path = 'covers/x.jpg' where slug = 'body-pump';
update coaches set display_name = 'HAMZA EDIT', bio = 'Bio', is_active = false where slug = 'hamza';
delete from coach_activities where coach_id = (select id from coaches where slug = 'yousra');
insert into activities (slug, name, category) values ('demo-junk', 'Activité ajoutée en démo', 'fitness');
insert into rooms (name) values ('[DEMO] Ancienne salle');
insert into news (slug, category, title, excerpt, body, status) values ('brouillon-x', 'offer', 'Brouillon', 'x', 'x', 'draft');
insert into auth.users (id, is_anonymous) values ('00000000-0000-0000-0000-00000000aaaa', true);
insert into admin_audit_log (action, entity_type) values ('session.updated', 'class_session');

select lives_ok(:'staging_reset', 'runs on a staging-marked database');

select set_eq(
  $$ select slug, name, category::text, sort_order from activities where slug <> 'demo-junk' $$,
  $$ select * from ref_activities $$, 'activities restored to the seed');
select is((select count(*) from activities where is_active)::int, 19, 'only the 19 roster classes are active');
select is((select count(*) from activities where image_path is not null)::int, 0, 'no uploaded images kept');
select set_eq($$ select slug, display_name, sort_order from coaches $$, $$ select * from ref_coaches $$, 'coaches restored to the seed');
select is((select count(*) from coaches where not is_active or bio is not null)::int, 0, 'coaches active, no invented bio');
select set_eq(
  $$ select c.slug as coach, a.slug as activity from coach_activities ca join coaches c on c.id = ca.coach_id join activities a on a.id = ca.activity_id $$,
  $$ select * from ref_pairs $$, 'coach ↔ class pairings restored to the seed');

select is((select count(*) from rooms where name like '%[DEMO]%')::int, 0, 'no [DEMO] labels in rooms');
select ok(
  (select count(*) from class_sessions) > 30
  and (select min(session_date) from class_sessions) = date_trunc('week', now() at time zone club_time_zone())::date
  and (select max(session_date) from class_sessions) <= date_trunc('week', now() at time zone club_time_zone())::date + 13,
  'two weeks of planning from the current club week');
select is((select count(*) from class_sessions s where not exists (
  select 1 from coach_activities ca where ca.coach_id = s.coach_id and ca.activity_id = s.activity_id))::int, 0,
  'every session pairs a coach with a class they teach');
select results_eq($$ select count(*)::int, count(*) filter (where status = 'published')::int from news $$,
  $$ values (4, 4) $$, 'four published news items, no drafts');
select is((select count(*) from auth.users where is_anonymous)::int, 0, 'guest identities removed');
select is((select count(*) from admin_audit_log)::int, 0, 'journal starts clean');

create temp table first_run as select (select count(*) from class_sessions) as sessions, (select count(*) from news) as news;
select lives_ok(:'staging_reset', 'can be run again');
select results_eq($$ select (select count(*) from class_sessions), (select count(*) from news) $$,
  $$ select sessions, news from first_run $$, 'idempotent: same dataset after a second run');

select * from finish();
rollback;
