# Arena Fit — Technical architecture

Status: Sprint 3 (Supabase public catalogue) done, awaiting review. This document is the reference for the
next sprints. Product requirements live in the master build brief. This
document only covers how the product is built.

## 1. Overview

```
┌──────────────────────┐     ┌──────────────────────────┐
│ apps/mobile (Expo)   │     │ apps/admin (Next.js)     │  Sprint 6–7
│ members, guests,     │     │ admin dashboard          │
│ visitors             │     │ /reception/scanner       │
└─────────┬────────────┘     └────────────┬─────────────┘
          │ anon key + user JWT (RLS)     │ user JWT (RLS) + server-only
          │                               │ service role for privileged jobs
          ▼                               ▼
┌──────────────────────────────────────────────────────────┐
│ Supabase                                                 │
│  Postgres (RLS on every table) · Auth · Storage          │
│  SECURITY DEFINER RPCs: guest invitations, QR checks     │
│  Edge Functions: push fan-out (Expo Push API)            │
└──────────────────────────────────────────────────────────┘
```

* **Monorepo**: npm workspaces (`apps/*`). The Supabase project lives in
  `supabase/` (migrations and seed), and the Supabase CLI owns it.
* **No service-role key in any client.** The mobile app uses the anon key only.
  The admin uses the user's session. Privileged jobs (push fan-out) run in
  Edge Functions or Next.js server code.

## 2. Mobile app (`apps/mobile`)

| Concern | Choice |
| --- | --- |
| Runtime | Expo SDK 58, React Native 0.88, React 19.3, New Architecture, React Compiler |
| Routing | Expo Router, typed routes. Custom JS tab bar (`expo-router/js-tabs`) for brand control |
| Styling | `StyleSheet` + design tokens (`src/theme/tokens.ts`). No UI kit dependency |
| Type | Inter (via `@expo-google-fonts/inter`). Swap for the brand font if Arena Fit has one |
| Motion | Reanimated 4 (press scale, staggered entrance, skeleton pulse). Respects reduced motion |
| i18n | i18next + react-i18next + expo-localization. FR is the source, AR/EN typed against it |
| Data | UI → query hooks (`src/data/queries.ts`, TanStack Query) → `ContentRepository` interface → Supabase repository (`src/data/supabase/`, anon key, rows validated with Zod). Dev-only fixture repository when Supabase isn't configured (`src/data/source.ts`). See §7 |
| Local state | AsyncStorage-backed stores (`src/lib/persisted-store.ts`) for favorites, reminders and notification preferences. No account needed |
| Session storage (Sprint 3+) | `expo-secure-store` for the auth token, created only for guests and members |
| Config | `src/config/env.ts`: `EXPO_PUBLIC_*` variables (invite base URL, Branch key, Supabase). See `.env.example` |
| Notifications (Sprint 4) | `expo-notifications`: local reminders + Expo push tokens |

### Folder structure

```
apps/mobile/
  app.json
  assets/
    brand/              ← official logo files go here (see README inside)
    images/             ← app icon / splash (placeholders until brand files arrive)
  src/
    app/                ← routes only (Expo Router)
      _layout.tsx       root: fonts, splash, theme, stack
      (tabs)/           Accueil · Planning · Activités · Actualités · Profil
        _layout.tsx
        index.tsx  planning.tsx  activites.tsx  actualites.tsx  profil.tsx
      classes/[id].tsx  activities/[slug].tsx  coaches/[slug].tsx  news/[slug].tsx
      pass/index.tsx    Profil › Pass & Invitations (members)
      settings/notifications.tsx  settings/account.tsx  help.tsx  login.tsx
      dev/ui.tsx        design-system gallery (dev builds only)
      +not-found.tsx
      # upcoming: invite/[token].tsx, guest/index.tsx (Sprint 5)
    components/
      ui/               primitives: Text, Button, IconButton, Chip, ChipRow, Badge, Card,
                        Avatar, ListRow/ListGroup, InfoTile, IntensityMeter, BottomSheet,
                        Toast, Screen, DetailScreen, ScreenHeader, SectionHeader,
                        Skeleton, EmptyState, ErrorState, PressableScale, FadeIn, Icon
      cards/            ClassCard, NextClassCard, MediaCard, NewsCard, CoachCard,
                        GuestPassCard, MembershipCard
      planning/         WeekSelector, SessionList
      brand/            Logo (official file only), Artwork (photo slot + category fallback)
      navigation/       TabBar
    config/             env.ts (public runtime config)
    data/               repository interface, query hooks + cache policy, data source selection,
                        supabase/ (client, row schemas, repository), fixture repository (dev)
    dev/fixtures/       DEVELOPMENT ONLY mock data (see header of each file)
    features/           session/, favorites/, reminders/, planning/, settings/
    i18n/               index.ts, locales/{fr,en,ar}.ts, typed keys
    lib/                club-clock (controlled instants), club-time (calendar/formatting),
                        persisted-store, haptics
  tests/                node:test suites (club clock, Supabase repository integration)
  scripts/              check-release-bundle.sh
    theme/              tokens
    types/              UI view models (mirror the DB schema)
```

Rules: screens never hardcode colors, sizes or user-facing strings. Route files
stay thin and compose `features/*` and `components/*`.

## 3. Admin dashboard (`apps/admin`, Sprint 6–7)

Next.js (App Router) + TypeScript + `@supabase/ssr`. Middleware requires a
session, and layouts check `admin_users.role` (`admin` everywhere,
`reception` only `/reception/*`). Forms validate with Zod on the server
(server actions) before writing. Camera scanning on `/reception/scanner` uses
the browser `BarcodeDetector` API with a small JS fallback (e.g. `@zxing/browser`).

## 4. Data model

Source of truth: `supabase/migrations/20261025000000_initial_schema.sql`
(tested against Postgres 16 with RLS smoke tests).

| File | Contents |
| --- | --- |
| `supabase/seed.sql` | **Production.** Only Arena Fit facts: the 7 coaches, 19 classes, 28 coach↔class links, club timezone and the initial allowance of 3 Guest Passes. Unknown fields stay NULL |
| `supabase/fixtures/dev.sql` | **Development only.** `[DEMO]` rooms and a mock weekly schedule built from real coach↔class pairings |
| `apps/mobile/src/dev/fixtures/` | **Development only.** The same mock schedule plus mock descriptions, news, member and invitations for the app |

### Schedule time model

Classes are club-local wall-clock times: `class_sessions.session_date` (date)
+ `start_time` / `end_time` (time), interpreted in `Africa/Casablanca`. A class
"at 18:00" stays at 18:00 whatever Morocco's UTC offset is (standard time,
Ramadan switch, or any future rule change). The app displays these values as-is
and never converts them. Classes never span midnight.

**Controlled club clock.** Morocco moved to permanent UTC+0 on 2026-09-20, and
device/engine tz data can lag behind (Node's bundled ICU here still says UTC+1).
So instants are never resolved through the device's `Africa/Casablanca` rules:

* `public.club_utc_offsets` (migration `20261025120000_club_clock.sql`) holds the
  offsets (IANA tzdata 2026e, 2024 onwards). `club_instant(date, time)`,
  `club_local_timestamp(instant)` and the computed fields `starts_at` / `ends_at`
  use it.
* `apps/mobile/src/lib/club-clock.ts` mirrors the table and is the only place the
  app converts between instants and club time (`clubNow`, `clubInstant`,
  `clubWallClock`). A test fails if the two copies drift.
* Ambiguous wall time (the repeated 01:00–01:59 on 2026-09-20) resolves to the
  earlier instant. A non-existent time shifts forward by the gap.
* Tests: `apps/mobile/tests/club-clock.test.mts` (run under 5 device timezones),
  `supabase/tests/clock.test.sql`, and a server/app parity check in the
  repository integration test.

| Area | Tables |
| --- | --- |
| Identity | `profiles` (kind: guest / member; created only when an identity is needed), `admin_users` (admin / reception) |
| Membership | `memberships` (plan name, type, validity; managed by admins) |
| Catalogue | `coaches`, `activities`, `coach_activities`, `rooms` |
| Planning | `class_sessions` (concrete dated sessions, visibility, cancellation) |
| Preferences | `favorite_activities`, `class_reminders`, `notification_preferences`, `device_tokens` |
| Content | `news`, `notifications` (admin push campaigns, simple targeting) |
| Guest passes | `guest_pass_balances`, `guest_invitations`, `guest_passes`, `guest_redemptions`, view `guest_pass_availability` |
| Config | `app_settings` (key/value jsonb; `is_public` exposes it to apps) |

Changes from the suggested entity list, and why:

* **`rooms`** was added so the planning filters and admin pickers don't depend on free text.
* **`class_reminders`** was added. Reminders fire locally on the device. For signed-in
  users the backend can also know who follows a session, to warn them when it moves or is
  cancelled. Visitors' reminders stay on the device only.
* **`notification_preferences`** was added as its own table, separate from `profiles`.
* **Guest-pass "available" is computed, not stored.** Availability = allowance −
  invitations that consume a pass (view `guest_pass_availability`). Stored
  invitation statuses: `sent, activated, used, expired, cancelled, converted`.
* **Translations**: content tables carry an `i18n jsonb` column
  (`{ar:{…}, en:{…}}`) next to the French source columns.

### Security model (RLS)

* Catalogue, visible sessions, published news and public settings are readable by `anon`.
* Personal tables are owner-only. `profiles.kind` is not user-updatable (column grants).
* `members`-visibility sessions need `is_member()`. Admin writes need `is_admin()`.
* Guest tables have **no client write policies**. Every mutation goes through
  `SECURITY DEFINER` RPCs that validate state transitions.
* Tokens: link and QR tokens are 256-bit random values. Only `sha256(token)` is stored.

### Identity model

* **Visitors** (default) browse Planning, Activities, Coaches, News and club information
  with **no Supabase user**. Favorites, reminders and notification preferences live on the
  device.
* **Guests** get a Supabase identity only when they activate a Guest Pass.
* **Members**: the activation and sign-in flow is not decided yet. The auth layer must
  support phone-based sign-in for members imported by the club. Sprint 2 uses dev-only mock
  member state (`src/features/session/session.tsx`). Release builds are always visitors until
  real auth lands. No membership sync is built.

### Guest-pass flow (Sprints 5–6)

Primary path: **Branch deferred deep linking**. No hardcoded domain: the link base
comes from `EXPO_PUBLIC_INVITE_BASE_URL` and the Branch key from `EXPO_PUBLIC_BRANCH_KEY`.

1. Member → `create_guest_invitation(invitee_name)` → checks availability → returns the raw
   link token once → Branch link carrying the token, shared via the native share sheet
   (WhatsApp first).
2. Friend opens the link. If the app is installed, it opens `invite/[token]` directly.
   Otherwise the friend goes to the store, installs, opens Arena Fit, and the Branch SDK
   returns the original link data on first launch, so the invitation is recovered automatically.
3. Fallback only if deferred attribution fails: a short invitation code shown on the
   link's web fallback page, entered once in the app.
4. App → `activate_guest_invitation(token)` (the guest identity is created here) → profile becomes `guest`, a
   `guest_passes` row is created with a **different** QR token (raw value kept in SecureStore,
   re-issuable via `rotate_guest_pass_qr()`).
5. Reception → `check_guest_pass(qr)` (read-only verdict: valid / invalid / expired / used /
   cancelled + sponsor, expiry) → `redeem_guest_pass(qr)` inserts into `guest_redemptions`
   (unique per pass, so double use is impossible even with concurrent scans) and sets status `used`.

## 5. Phased plan

| Sprint | Scope | Exit criteria |
| --- | --- | --- |
| 1 ✅ | Workspace, Expo Router, tokens, typography, i18n, tab navigation, logo slot, UI primitives, cards, skeletons, empty states, schema and seed | `tsc` clean, web/Android bundle exports, UI kit renders with no console errors |
| 2 ✅ | Home, Planning (week selector + filters), Class detail, Activities, Coaches, News list/detail, Profile, Pass & Invitations UI, local reminders/favorites. Dev fixtures based on the real roster | All screens navigable with realistic data, plus loading, empty and error states |
| 3 ✅ | Supabase repositories for coaches, activities, planning and news (no login), controlled club clock, image storage, pgTAP RLS/seed/clock tests, cache strategy, release-bundle check | App runs against Supabase as a visitor, RLS verified in SQL and over HTTP |
| 4 | Reminders (local scheduling, 15/30/60/120 min, server mirror), push token registration, notification preferences, schedule-change pushes (Edge Function) | Reminder fires on device, and a changed session re-notifies followers |
| 5 | Guest-pass RPCs, offer/share flow, Branch deferred deep linking (+ code fallback), invitation states, Guest Mode gating | End-to-end: member shares → guest activates → QR shown |
| 6 | Admin app scaffold and auth, `/reception/scanner`, check/redeem RPCs | A pass can't be redeemed twice. All verdict screens done |
| 7 | Admin CRUD: planning (duplicate session/week), coaches (photo upload), activities, news (publish/unpublish), notifications, members, guest passes, settings | Admin changes show up in the app |
| 8 | Tests (RLS/pgTAP, RPC, component), error boundaries, performance, a11y pass, security review, EAS builds | Release candidates for Android and iOS |

## 6. Risks and open points

1. **Logo file not received in the dev environment.** The logo green (#80B918) is now the
   `brand` token, and the brighter lime stays for CTAs and active states. The `Logo` component
   still shows a neutral placeholder until the file is committed to
   `apps/mobile/assets/brand/` and wired in `logo-source.ts` (rendered as-is, never recolored).
   App icon and splash are still Expo placeholders.
2. **No photography yet.** Image slots exist everywhere (`imageUrl` / `coverUrl` / `photoUrl`).
   Until club photos are uploaded, `Artwork` shows a category-tinted placeholder.
3. **Branch setup** needs a Branch account, the final domain, iOS associated domains and
   Android intent filters (config plugin) in the Guest Pass sprint. Branch's React Native
   SDK needs a development build, not Expo Go.
4. **Member authentication** is pending your decision. The `AuthProvider` boundary
   (`src/features/session/`) is ready for it.
5. **Reminder fire times** (Sprint 4) must come from `clubInstant()` / `starts_at`, never from
   device tz rules. A future Moroccan rule change means a new `club_utc_offsets` migration
   plus an app update. Pushing the offsets to the app at runtime is possible if that's too slow.
6. **Activity categories** of club-specific formats are inferred from names. They're flagged
   for club review in `seed.sql`.
7. **Recurring schedule.** The MVP stores concrete sessions, and the admin duplicates days
   or weeks.
8. **Admin app in the same workspace.** Next.js and React Native must agree on the hoisted
   `react` version. Otherwise the admin app gets its own install.
9. **Arabic translations** are a draft and need a native review. RTL layout gets QA'd
   before AR ships. The app is pinned to French until then.
10. **Guest Pass rules not yet set:** invitation-link validity, pass validity, and whether an
    expired, never-activated invitation gives the pass back (currently defaults to yes in
    the `guest_pass_availability` view). To decide before Sprint 5.

## 7. Data layer (Sprint 3)

```
Screen ─► query hook (src/data/queries.ts) ─► ContentRepository ─► Supabase repository ─► PostgREST (anon key, RLS)
                                                                └► fixture repository (dev builds only)
```

* **No Supabase in components.** Screens import hooks only. Hooks import the
  `repository` chosen in `src/data/source.ts`.
* **Source selection:** Supabase when `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` are set.
  Fixtures in development otherwise, or when `EXPO_PUBLIC_DATA_SOURCE=fixtures`. A release
  build without config fails with `config` errors (error states), never mock data. Fixtures
  and the mock member are excluded from release bundles (`npm run check:release` verifies it).
* **Errors** are `DataError` kinds: `network`, `server` (retried), `rejected`,
  `invalid-data`, `config` (not retried). supabase-js's own retries are disabled, so
  TanStack Query owns the policy: 2 retries with backoff, and the error state after about 4s.
* **Cache:** catalogue 30 min, planning 5 min, news 10 min stale time, 24 h garbage
  collection. The planning is fetched one week at a time and day/category filters derive
  from it. The next week is prefetched. Detail screens are seeded from cached lists, keeping
  the list's fetch time. Data refetches on app foreground (when stale) and on pull-to-refresh
  (invalidation). Cached data stays visible when a refetch fails.
* **Defence in depth:** besides RLS, the repository filters `is_active`, `status = 'published'`,
  `published_at <= now()` and `visibility <> 'hidden'`, so an admin account never sees drafts
  in the member app.
* **Images:** nullable `*_path` columns, public buckets `coaches`, `activities`, `classes`
  (new, a per-session override) and `news`, images only and 5 MB max. Missing image means
  fallback artwork.
* **Favorites** are stored on the device by activity **slug**, so they can migrate to
  `favorite_activities` after member activation.
* **Auth boundary:** `AuthProvider` (`restore`, `signOut`). Release builds use the visitor
  provider, development builds the mock provider. A real member provider plugs in without
  screen changes.

### Checks

| Command | What it verifies |
| --- | --- |
| `npm run typecheck` / `npm run lint` (apps/mobile) | TypeScript, ESLint (expo config, React Compiler rules) |
| `npm test` (apps/mobile) | Club clock tests. Plus the Supabase repository integration suite when `SUPABASE_TEST_URL` / `SUPABASE_TEST_ANON_KEY` are set |
| `npm run test:timezones` | Club clock under 5 device timezones |
| `npm run check:release` | Production Android/iOS bundles contain no fixtures, mock member or service-role key |
| `npm run db:test` (root) | Clean DB, then migrations, production seed, pgTAP (clock, seed facts, RLS), dev fixtures load check |
