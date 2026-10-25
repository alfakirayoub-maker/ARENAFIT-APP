# Arena Fit

Official Arena Fit app: a mobile companion for members and invited guests, plus
an admin dashboard (next sprints).

```
apps/mobile     Expo (React Native) app — iOS / Android
supabase/       database migrations, RLS policies, seed data
docs/           architecture & plan (docs/ARCHITECTURE.md), dev builds & notifications (docs/DEV_BUILD.md),
                invitation links & Branch (docs/BRANCH.md), reception QR operations (docs/RECEPTION.md)
scripts/        DB tests (scripts/db), local Supabase-like API (scripts/local-stack),
                reception QR print assets (scripts/reception)
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

In development, Profil → **Développement** switches between visitor, a demo member (fixtures,
no backend) and the local test member (real Supabase user; needs `EXPO_PUBLIC_DEV_MEMBER_*`
in `.env.local`), and opens the UI kit. Guest Mode is reached the real way: open an
invitation link and tap « Activer mon Pass ».

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

### Local API without the Supabase CLI

```bash
scripts/local-stack/up.sh   # Postgres + GoTrue (anonymous sign-in) + PostgREST on :54321, test members
# prints the .env.local values and the integration-test command
cd apps/mobile && SUPABASE_TEST_URL=http://localhost:54321 \
  SUPABASE_TEST_ANON_KEY=$(cat ../../.local-stack/anon-key) \
  SUPABASE_TEST_SERVICE_KEY=$(cat ../../.local-stack/service-key) npm test
```

The service-role key is used only by that test harness (to create test members and simulate
expiry) — never by the app.
