-- Club clock around Morocco's 2026-09-20 switch to permanent UTC+0.
-- Same cases as apps/mobile/tests/club-clock.test.mts.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

select is(club_offset_minutes_at('2026-09-20 00:59:59+00'), 60, 'UTC+1 just before the switch');
select is(club_offset_minutes_at('2026-09-20 01:00:00+00'), 0, 'UTC+0 from the switch');
select is(club_offset_minutes_at('2027-02-15 12:00:00+00'), 0, 'no Ramadan offset change after the switch');

select is(club_instant('2026-09-19', '18:00'), '2026-09-19 17:00:00+00'::timestamptz, '18:00 the day before → 17:00 UTC');
select is(club_instant('2026-09-20', '18:00'), '2026-09-20 18:00:00+00'::timestamptz, '18:00 on the switch day → 18:00 UTC');
select is(club_instant('2026-10-25', '18:30'), '2026-10-25 18:30:00+00'::timestamptz, 'after the switch: wall clock = UTC');
select is(club_instant('2026-09-20', '01:30'), '2026-09-20 00:30:00+00'::timestamptz, 'repeated hour → earlier instant');
select is(club_instant('2026-03-22', '02:30'), '2026-03-22 02:30:00+00'::timestamptz, 'non-existent time → shifted forward');

select is(club_local_timestamp('2026-09-19 23:30:00+00'), '2026-09-20 00:30:00'::timestamp, 'midnight crossing before the switch');
select is(club_local_timestamp('2026-10-25 16:30:00+00'), '2026-10-25 16:30:00'::timestamp, 'no one-hour shift after the switch');

-- Session computed fields use the controlled clock.
insert into class_sessions (id, activity_id, session_date, start_time, end_time)
select '00000000-0000-0000-0000-00000000c10c', id, '2026-09-19', '18:00', '19:00' from activities where slug = 'rpm';
select is(
  (select starts_at(s) from class_sessions s where id = '00000000-0000-0000-0000-00000000c10c'),
  '2026-09-19 17:00:00+00'::timestamptz,
  'starts_at() resolves through club_instant()'
);

set local role authenticated;
select throws_ok(
  $$ insert into club_utc_offsets (effective_from, utc_offset_minutes) values ('2030-01-01', 60) $$,
  '42501', null, 'clients cannot change the club clock'
);

select * from finish();
rollback;
