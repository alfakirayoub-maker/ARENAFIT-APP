-- =============================================================================
-- LOCAL TESTING ONLY — minimal stand-ins for what a Supabase project provides
-- (roles, auth schema, storage schema, default grants), so migrations and
-- pgTAP tests can run against a plain PostgreSQL when the Supabase CLI is not
-- available. Never apply this to a Supabase project: it already has all of it.
-- Used by scripts/db/test.sh.
-- =============================================================================

-- Roles are cluster-wide: create each one only if missing.
do $$
declare
  r record;
begin
  for r in select * from (values
    ('anon', 'nologin noinherit'),
    ('authenticated', 'nologin noinherit'),
    ('service_role', 'nologin noinherit bypassrls'),
    ('authenticator', 'login noinherit password ''authenticator''')
  ) as t(name, opts)
  loop
    if not exists (select 1 from pg_roles where rolname = r.name) then
      execute format('create role %I %s', r.name, r.opts);
    end if;
  end loop;
end
$$;
grant anon, authenticated, service_role to authenticator;

create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);

-- Same resolution order as Supabase's auth.uid() / auth.role().
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )
$$;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;

grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated;
grant all on storage.objects to anon, authenticated, service_role;

-- Supabase's default privileges on the public schema (RLS does the filtering).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
