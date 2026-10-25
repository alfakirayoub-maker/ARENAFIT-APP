# Arena Fit — Technical architecture

Status: Sprint 2 (screens on dev fixtures) done, awaiting review. This document is the reference for the
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
| Data | TanStack Query over a `ContentRepository` interface (`src/data/`). Fixture implementation now, Supabase implementation in Sprint 3. Zod at the boundary (RPC payloads, deep-link params) |
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
    data/               repository interface, fixture repository, query hooks
    dev/fixtures/       DEVELOPMENT ONLY mock data (see header of each file)
    features/           session/, favorites/, reminders/, planning/, settings/
    i18n/               index.ts, locales/{fr,en,ar}.ts, typed keys
    lib/                club-time (club-local calendar), persisted-store, haptics
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
and never converts them. Absolute instants are derived only when needed
(reminder scheduling, push timing) with `club_instant(date, time)` and the
PostgREST computed fields `starts_at` / `ends_at`. Classes never span midnight.

Note on tz data: the server's tzdata (2026e) and Node's bundled ICU currently
disagree about Morocco's offset since 20 Sep 2026 (UTC+0 vs UTC+1). Wall-clock
storage makes the planning immune to that. Sprint 4 must compute reminder
fire times from the club wall-clock time in a way that does not depend on stale
device tz data (see risks).

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
| 3 | Supabase repository (public content, no login), generated DB types. Member auth once the activation flow is decided (phone-based / imported members) | App runs against a Supabase project as a visitor, and RLS is verified from the client |
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
4. **Member authentication** is pending your decision (before Sprint 3 auth work).
5. **Reminder fire times vs. device tz data** (Sprint 4). Device tz databases can lag behind
   Morocco's rule changes. Options: schedule from the server-computed instant
   (`starts_at`), or from wall-clock components when the device is set to
   Africa/Casablanca. To decide in Sprint 4.
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
