-- =============================================================================
-- Image storage
--
-- Images are always optional: every *_path column is nullable and the apps
-- render a fallback when it is NULL. Paths are object keys inside the bucket:
--
--   coaches/<coach-slug>/<file>        → coaches.photo_path
--   activities/<activity-slug>/<file>  → activities.image_path
--   classes/<session-id>/<file>        → class_sessions.image_path (overrides the activity image)
--   news/<article-slug>/<file>         → news.cover_path
-- =============================================================================

alter table public.class_sessions add column image_path text;

comment on column public.coaches.photo_path is 'Object key in the public "coaches" bucket; NULL = no photo yet';
comment on column public.activities.image_path is 'Object key in the public "activities" bucket; NULL = fallback artwork';
comment on column public.class_sessions.image_path is 'Object key in the public "classes" bucket; NULL = use the activity image';
comment on column public.news.cover_path is 'Object key in the public "news" bucket; NULL = fallback artwork';

insert into storage.buckets (id, name, public)
values ('classes', 'classes', true)
on conflict (id) do nothing;

-- Images only, 5 MB max, for every bucket the apps read from.
update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id in ('coaches', 'activities', 'classes', 'news', 'avatars');

drop policy "content buckets: admin write" on storage.objects;
create policy "content buckets: admin write" on storage.objects
  for all to authenticated
  using (bucket_id in ('coaches', 'activities', 'classes', 'news') and public.is_admin())
  with check (bucket_id in ('coaches', 'activities', 'classes', 'news') and public.is_admin());
