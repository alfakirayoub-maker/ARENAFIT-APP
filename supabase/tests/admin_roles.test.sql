-- Admin dashboard: roles, role-aware RLS, admin RPCs, audit trail, secrets.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(74);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test'),
  ('00000000-0000-0000-0000-0000000000a2', 'content@test'),
  ('00000000-0000-0000-0000-0000000000a3', 'reception@test'),
  ('00000000-0000-0000-0000-0000000000b1', 'member@test'),
  ('00000000-0000-0000-0000-0000000000c1', null);
update profiles set kind = 'member', first_name = 'Ayoub', last_name = 'A.' where id = '00000000-0000-0000-0000-0000000000b1';
insert into memberships (profile_id, plan_name, membership_type, starts_on)
  values ('00000000-0000-0000-0000-0000000000b1', 'Test plan', 'test', current_date - 30);
insert into admin_users (user_id, role, display_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin', 'Admin Test'),
  ('00000000-0000-0000-0000-0000000000a2', 'content_manager', 'Contenu Test'),
  ('00000000-0000-0000-0000-0000000000a3', 'reception', 'Accueil Test');
select throws_ok($$ insert into admin_users (user_id, role) values ('00000000-0000-0000-0000-0000000000b1', 'owner') $$,
  '23514', null, 'only known roles');

create temp table t (k text primary key, v jsonb);
grant all on t to anon, authenticated, service_role;
create function pg_temp.as_user(p_id text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', p_id)::text, true)
$$;
create function pg_temp.as_anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true)
$$;
create function pg_temp.v(p_k text) returns jsonb language sql as $$ select v from t where k = p_k $$;
grant execute on function pg_temp.v(text) to public;
create function pg_temp.rpm() returns uuid language sql as $$ select id from public.activities where slug = 'rpm' $$;
create function pg_temp.hamza() returns uuid language sql as $$ select id from public.coaches where slug = 'hamza' $$;
grant execute on function pg_temp.rpm(), pg_temp.hamza() to public;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select is(admin_whoami() ->> 'role', 'admin', 'admin is recognised');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select is(admin_whoami() ->> 'role', 'content_manager', 'content manager is recognised');
update admin_users set role = 'admin' where user_id = auth.uid();
select is(admin_whoami() ->> 'role', 'content_manager', 'a content manager cannot promote themselves (update filtered)');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select ok(admin_whoami() is null, 'a member is not staff');
select throws_ok($$ insert into admin_users (user_id, role) values (auth.uid(), 'admin') $$, '42501', null,
  'a member cannot grant themselves a role');
select pg_temp.as_anon();
select throws_ok($$ select admin_whoami() $$, '42501', null, 'public visitors cannot call admin functions');

-- ---------------------------------------------------------------------------
-- Non-staff: no admin data, no writes
-- ---------------------------------------------------------------------------
select throws_ok($$ select 1 from admin_audit_log $$, '42501', null, 'public cannot read the audit log');
select throws_ok($$ select admin_dashboard_stats() $$, '42501', null, 'public cannot read stats');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select admin_dashboard_stats() $$, '42501', 'forbidden', 'members cannot read stats');
select throws_ok($$ select admin_list_guest_invitations() $$, '42501', 'forbidden', 'members cannot list guest passes');
select throws_ok($$ select admin_list_members() $$, '42501', 'forbidden', 'members cannot list members');
select throws_ok($$ select admin_create_reception_station('X') $$, '42501', 'forbidden', 'members cannot create stations');
select is((select count(*) from admin_audit_log)::int, 0, 'members see no audit rows');
select throws_ok(format('insert into class_sessions (activity_id, session_date, start_time, end_time) values (%L, current_date, %L, %L)',
  pg_temp.rpm(), '18:00', '19:00'), '42501', null, 'members cannot create sessions');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select admin_list_reception_stations() $$, '42501', 'forbidden', 'guests cannot list stations');
select throws_ok($$ select admin_duplicate_session(gen_random_uuid(), array[current_date]) $$, '42501', 'forbidden',
  'guests cannot duplicate sessions');

-- ---------------------------------------------------------------------------
-- Content manager: planning, catalogue, news, notification drafts
-- ---------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select lives_ok(format(
  'insert into class_sessions (id, activity_id, coach_id, session_date, start_time, end_time) values (%L, %L, %L, %L, %L, %L)',
  '00000000-0000-0000-0000-00000000005a', pg_temp.rpm(), pg_temp.hamza(), '2026-11-02', '18:00', '18:45'),
  'content manager creates a session');
select lives_ok($$ update class_sessions set start_time = '19:00', end_time = '19:45'
  where id = '00000000-0000-0000-0000-00000000005a' $$, 'content manager moves it to 19:00');
insert into t values ('dup', admin_duplicate_session('00000000-0000-0000-0000-00000000005a', array['2026-11-09', '2026-11-16']::date[]));
select is(jsonb_array_length(pg_temp.v('dup') -> 'created'), 2, 'duplicates to two dates');
select is(jsonb_array_length(admin_duplicate_session('00000000-0000-0000-0000-00000000005a', array['2026-11-09']::date[]) -> 'skipped'), 1,
  'duplicating again skips the existing date');
select lives_ok($$ update class_sessions set is_cancelled = true, cancellation_note = 'Coach absent'
  where id = '00000000-0000-0000-0000-00000000005a' $$, 'content manager cancels it');

select lives_ok(format('update coaches set bio = %L where slug = %L', 'Coach de cycling', 'hamza'), 'content manager edits a coach');
select lives_ok($$ update coaches set is_active = false where slug = 'ali' $$, 'content manager deactivates a coach');
select throws_ok($$ delete from coaches where slug = 'ali' $$, '42501', null, 'coaches are never hard-deleted');
select throws_ok($$ delete from activities where slug = 'rpm' $$, '42501', null, 'activities are never hard-deleted');
select lives_ok($$ update activities set intensity = 4, short_description = 'Vélo indoor en musique' where slug = 'rpm' $$,
  'content manager edits an activity');
select lives_ok(format('select admin_set_coach_activities(%L, array[%L]::uuid[])', pg_temp.hamza(), pg_temp.rpm()),
  'content manager sets coach activities');
select is((select count(*) from coach_activities where coach_id = pg_temp.hamza())::int, 1, '…replacing the list');

select lives_ok($$ insert into news (id, slug, category, title, excerpt, body)
  values ('00000000-0000-0000-0000-0000000000e1', 'test-admin', 'announcement', 'Nouveauté', 'Court', 'Texte') $$,
  'content manager saves a draft');
select lives_ok($$ update news set status = 'published', published_at = now() - interval '1 minute'
  where id = '00000000-0000-0000-0000-0000000000e1' $$, 'publishes it');

select pg_temp.as_anon();
select is((select count(*) from news where slug = 'test-admin')::int, 1, 'published news is public');
select is((select is_cancelled from class_sessions where id = '00000000-0000-0000-0000-00000000005a'), true,
  'the public sees the session as cancelled (the app shows « Annulé » and drops reminders)');
select is((select start_time::text from class_sessions where id = '00000000-0000-0000-0000-00000000005a'), '19:00:00',
  'the public sees the new time');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$ update news set status = 'draft' where id = '00000000-0000-0000-0000-0000000000e1' $$, 'unpublishes it');
select lives_ok($$ update class_sessions set visibility = 'hidden' where id = (pg_temp.v('dup') -> 'created' ->> 0)::uuid $$,
  'hides a duplicated session');
select pg_temp.as_anon();
select is((select count(*) from news where slug = 'test-admin')::int, 0, 'unpublished news disappears from public reads');
select is((select count(*) from class_sessions where id = (pg_temp.v('dup') -> 'created' ->> 0)::uuid)::int, 0,
  'hidden sessions are not public');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$ insert into notifications (category, title, body, audience) values ('club_news', 'Titre', 'Corps', 'all') $$,
  'content manager drafts a notification');
select throws_ok($$ insert into notifications (category, title, body, status) values ('club_news', 'T', 'B', 'sent') $$,
  '42501', null, 'cannot create a "sent" notification');
select throws_ok($$ update notifications set status = 'sent' $$, '42501', null, 'cannot mark a notification sent');
select throws_ok($$ insert into notifications (category, title, body, deep_link) values ('club_news', 'T', 'B', 'https://evil.test') $$,
  '23514', null, 'deep links stay inside the app');
select throws_ok($$ select admin_create_reception_station('X') $$, '42501', 'forbidden', 'content manager cannot create stations');
select throws_ok($$ select admin_list_guest_invitations() $$, '42501', 'forbidden', 'content manager cannot see guest passes');
select is((select count(*) from admin_audit_log)::int, 0, 'content manager cannot read the audit log');

-- ---------------------------------------------------------------------------
-- Reception: guest pass view + station list only
-- ---------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select lives_ok($$ select admin_list_guest_invitations() $$, 'reception lists guest passes');
select lives_ok($$ select admin_list_reception_stations() $$, 'reception lists stations');
select lives_ok($$ select admin_dashboard_stats() $$, 'reception sees the overview');
select throws_ok(format('insert into class_sessions (activity_id, session_date, start_time, end_time) values (%L, current_date, %L, %L)',
  pg_temp.rpm(), '18:00', '19:00'), '42501', null, 'reception cannot create sessions');
update news set title = 'HACK' where slug = 'test-admin';
select throws_ok($$ select admin_rotate_reception_station(gen_random_uuid()) $$, '42501', 'forbidden', 'reception cannot rotate stations');
select throws_ok($$ select admin_list_members() $$, '42501', 'forbidden', 'reception cannot list members');
reset role;
select is((select title from news where slug = 'test-admin'), 'Nouveauté', 'reception cannot edit news');

-- ---------------------------------------------------------------------------
-- Admin: stations, members, invitation cancel, audit
-- ---------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into t values ('st', admin_create_reception_station('Réception principale'));
select matches(pg_temp.v('st') ->> 'qr_payload', '^AFR1\.[A-Za-z0-9_-]{43}$', 'admin creates a station (payload returned once)');
insert into t values ('rot', admin_rotate_reception_station((pg_temp.v('st') ->> 'station_id')::uuid));
select isnt(pg_temp.v('rot') ->> 'qr_payload', pg_temp.v('st') ->> 'qr_payload', 'admin rotates it');
select lives_ok(format('select admin_set_reception_station_active(%L, false)', pg_temp.v('st') ->> 'station_id'), 'deactivates');
select lives_ok(format('select admin_set_reception_station_active(%L, true)', pg_temp.v('st') ->> 'station_id'), 'reactivates');
select ok(not (admin_list_reception_stations() -> 0 ? 'token_hash'), 'station list has no hash');
select is(admin_list_reception_stations() -> 0 ->> 'name', 'Réception principale', 'station list shows name');
select is(jsonb_array_length(admin_list_members()), 1, 'admin lists members');
select ok(not ((admin_list_members() -> 0) ?| array['phone', 'avatar_path']), 'member list has safe fields only');
select is((admin_list_members() -> 0 ->> 'available')::int, 3, 'member list shows the pass balance');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into t values ('inv', create_guest_invitation('Yassine'));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select is(admin_list_guest_invitations('sent') -> 0 ->> 'invitee_name', 'Yassine', 'admin filters invitations by status');
select ok(not (admin_guest_invitation_detail((pg_temp.v('inv') ->> 'invitation_id')::uuid)
  ?| array['link_token_hash', 'short_code_hash', 'share_token', 'guest_profile_id']), 'detail exposes no secrets');
select is(admin_cancel_guest_invitation((pg_temp.v('inv') ->> 'invitation_id')::uuid) ->> 'status', 'cancelled',
  'admin cancels an unused invitation');

-- Audit trail
select results_eq($$ select action from admin_audit_log where entity_type = 'class_session' and entity_id = '00000000-0000-0000-0000-00000000005a'
  order by id $$, $$ values ('session.created'), ('session.updated'), ('session.duplicated'), ('session.duplicated'), ('session.cancelled') $$,
  'session lifecycle audited');
select is((select actor_role from admin_audit_log where action = 'session.created' order by id limit 1), 'content_manager',
  'audit records the actor role');
select ok((select summary -> 'changed' ? 'start_time' from admin_audit_log where action = 'session.updated' limit 1),
  'audit records which fields changed');
select results_eq($$ select action from admin_audit_log where entity_type = 'news' order by id $$,
  $$ values ('news.created'), ('news.published'), ('news.unpublished') $$, 'news publish / unpublish audited');
select ok(exists (select 1 from admin_audit_log where action = 'coach.deactivated'), 'coach deactivation audited');
select ok(exists (select 1 from admin_audit_log where action = 'activity.updated'), 'activity edit audited');
select results_eq($$ select action from admin_audit_log where entity_type = 'reception_station' order by id $$,
  $$ values ('station.created'), ('station.rotated'), ('station.deactivated'), ('station.reactivated') $$, 'station lifecycle audited');
select ok(exists (select 1 from admin_audit_log where action = 'invitation.cancelled'), 'invitation cancel audited');
select is((select count(*) from admin_audit_log
  where summary::text like '%' || substr(pg_temp.v('st') ->> 'qr_payload', 6) || '%'
     or summary::text like '%' || substr(pg_temp.v('rot') ->> 'qr_payload', 6) || '%'
     or summary::text like '%token%')::int, 0, 'no station secret in the audit log');
select ok(jsonb_array_length(admin_list_audit_log(50)) >= 10, 'admin reads the audit trail');

select * from finish();
rollback;
