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
```

Add dependencies to the mobile app with `npx expo install <pkg>` from
`apps/mobile` so versions match the Expo SDK.

In development, Profil → **UI kit (dev)** opens the design-system gallery.

## Database

```bash
supabase init              # first time only: creates supabase/config.toml
supabase start
supabase db reset           # applies supabase/migrations + supabase/seed.sql
```
