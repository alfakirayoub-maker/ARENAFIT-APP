-- Row Level Security: public visitors (anon) may read only public content and
-- may never write; signed-in non-admins cannot modify the catalogue; private
-- tables stay private.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(36);

-- ---------------------------------------------------------------------------
-- Fixture rows (as table owner)
-- ---------------------------------------------------------------------------
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),  -- admin
  ('00000000-0000-0000-0000-0000000000b1'),  -- member
  ('00000000-0000-0000-0000-0000000000c1'),  -- guest
  ('00000000-0000-0000-0000-0000000000c2');  -- other guest
update profiles set kind = 'member' where id = '00000000-0000-0000-0000-0000000000b1';
insert into admin_users (user_id, role) values ('00000000-0000-0000-0000-0000000000a1', 'admin');
insert into memberships (profile_id, plan_name, membership_type, starts_on)
  values ('00000000-0000-0000-0000-0000000000b1', 'Test plan', 'test', current_date);

insert into class_sessions (id, activity_id, session_date, start_time, end_time, visibility)
select v.id::uuid, a.id, current_date, '18:00', '19:00', v.visibility::session_visibility
from (values
  ('00000000-0000-0000-0000-00000000005a', 'public'),
  ('00000000-0000-0000-0000-00000000005b', 'members'),
  ('00000000-0000-0000-0000-00000000005c', 'hidden')
) v(id, visibility)
cross join (select id from activities where slug = 'rpm') a;

insert into news (slug, category, title, excerpt, body, status, published_at) values
  ('test-published', 'announcement', 't', 'e', 'b', 'published', now() - interval '1 hour'),
  ('test-scheduled', 'announcement', 't', 'e', 'b', 'published', now() + interval '1 day'),
  ('test-draft', 'announcement', 't', 'e', 'b', 'draft', null);

create temp view test_sessions with (security_invoker = true) as
  select id from class_sessions where id in (
    '00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-00000000005b', '00000000-0000-0000-0000-00000000005c');
grant select on test_sessions to anon, authenticated;

-- ---------------------------------------------------------------------------
-- anon: public visitor, no account
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is((select count(*) from coaches)::int, 7, 'anon reads coaches');
select is((select count(*) from activities)::int, 19, 'anon reads activities');
select is((select count(*) from coach_activities)::int, 28, 'anon reads coach ↔ activity links');
select results_eq($$ select id::text from test_sessions $$, $$ values ('00000000-0000-0000-0000-00000000005a') $$,
  'anon sees public sessions only (not members-only, not hidden)');
select results_eq($$ select slug from news where slug like 'test-%' $$, $$ values ('test-published') $$,
  'anon sees published news only (not drafts, not scheduled)');
select is((select count(*) from club_utc_offsets)::int, 8, 'anon reads the club clock');
select results_eq($$ select key from app_settings order by key $$, $$ values ('club.timezone') $$,
  'anon reads public settings only');

select is_empty($$ select 1 from profiles $$, 'anon cannot read profiles');
select is_empty($$ select 1 from memberships $$, 'anon cannot read memberships');
select is_empty($$ select 1 from admin_users $$, 'anon cannot read staff');
select is_empty($$ select 1 from notifications $$, 'anon cannot read notification campaigns');
select throws_ok($$ select 1 from guest_pass_balances $$, '42501', null, 'anon has no access to guest pass balances');
select throws_ok($$ select 1 from guest_invitations $$, '42501', null, 'anon has no access to invitations');
select throws_ok($$ select 1 from guest_passes $$, '42501', null, 'anon has no access to guest passes');
select throws_ok($$ select 1 from guest_redemptions $$, '42501', null, 'anon has no access to redemptions');

select throws_ok($$ insert into coaches (slug, display_name) values ('fake', 'FAKE') $$, '42501', null, 'anon cannot create coaches');
select throws_ok($$ insert into activities (slug, name, category) values ('fake', 'Fake', 'fitness') $$, '42501', null, 'anon cannot create activities');
select throws_ok($$ insert into class_sessions (activity_id, session_date, start_time, end_time)
                    select id, current_date, '10:00', '11:00' from activities limit 1 $$, '42501', null, 'anon cannot create sessions');
select throws_ok($$ insert into news (slug, category, title, excerpt, body) values ('x', 'offer', 'x', 'x', 'x') $$, '42501', null, 'anon cannot create news');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('coaches', 'x/photo.jpg') $$, '42501', null, 'anon cannot upload images');
select lives_ok($$ update coaches set display_name = 'HACKED' $$, 'anon update is silently filtered…');
select lives_ok($$ delete from class_sessions $$, 'anon delete is silently filtered…');
select lives_ok($$ update news set title = 'HACKED' $$, 'anon news update is silently filtered…');

reset role;
select is((select count(*) from coaches where display_name = 'HACKED')::int, 0, '…and changed no coach');
select is((select count(*) from test_sessions)::int, 3, '…and deleted no session');
select is((select count(*) from news where title = 'HACKED')::int, 0, '…and changed no article');

-- ---------------------------------------------------------------------------
-- authenticated guest (not member, not admin)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000c1"}';

select results_eq($$ select id::text from profiles $$, $$ values ('00000000-0000-0000-0000-0000000000c1') $$,
  'a user reads only their own profile');
select throws_ok($$ update profiles set kind = 'member' where id = auth.uid() $$, '42501', null,
  'a user cannot promote themselves to member');
select results_eq($$ select id::text from test_sessions $$, $$ values ('00000000-0000-0000-0000-00000000005a') $$,
  'a guest does not see members-only sessions');
select throws_ok($$ insert into coaches (slug, display_name) values ('fake', 'FAKE') $$, '42501', null,
  'a signed-in non-admin cannot create coaches');
select lives_ok($$ update activities set name = 'HACKED' $$, 'non-admin activity update is silently filtered…');
reset role;
select is((select count(*) from activities where name = 'HACKED')::int, 0, '…and changed nothing');

-- ---------------------------------------------------------------------------
-- member
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000b1"}';
select is((select count(*) from test_sessions)::int, 2, 'a member sees public + members-only sessions');
select is((select count(*) from memberships)::int, 1, 'a member reads their own membership');
reset role;

-- ---------------------------------------------------------------------------
-- admin
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a1"}';
select is((select count(*) from news where slug like 'test-%')::int, 3, 'an admin sees drafts and scheduled news');
select lives_ok($$ insert into coaches (slug, display_name, is_active) values ('rls-test', 'RLS TEST', false) $$,
  'an admin can manage the catalogue');
reset role;

select * from finish();
rollback;
