# Arena Fit

Official Arena Fit app: a mobile companion for members and invited guests, plus
an admin dashboard (coming in Sprint 6–7).

```
apps/mobile     Expo (React Native) app — iOS / Android
supabase/       database migrations, RLS policies, seed data
docs/           architecture & plan (start with docs/ARCHITECTURE.md)
```

## Getting started

```bash
npm install                 # installs all workspaces
npm run mobile              # expo start (scan with a dev build / Expo Go)
npm run typecheck
npm test                    # unit tests (+ Supabase integration when SUPABASE_TEST_* is set)
npm run db:test             # clean DB: migrations, seed, pgTAP RLS/clock/seed tests
```

Add dependencies to the mobile app with `npx expo install <pkg>` from
`apps/mobile` so versions match the Expo SDK.

In development, Profil → **Développement** switches between visitor / guest / member mock sessions and opens the UI kit.

## Database

```bash
supabase init              # first time only: creates supabase/config.toml
supabase start
supabase db reset           # applies supabase/migrations + supabase/seed.sql (production facts only)
psql "$DATABASE_URL" -f supabase/fixtures/dev.sql   # optional: mock rooms, schedule, details, news (local only)
supabase test db            # pgTAP tests in supabase/tests
```

With `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` set (copy
`apps/mobile/.env.example` to `apps/mobile/.env.local`), the app reads Supabase.
Without them, development builds fall back to `apps/mobile/src/dev/fixtures/`
(mock data, not Arena Fit facts). Release builds never include fixtures.
Only the anon key ever goes in the app, never the service-role key.
