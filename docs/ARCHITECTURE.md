# Arena Fit — Technical architecture

Status: Sprint 1 (foundation) done. This document is the reference for the
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
| Data (Sprint 3) | `@supabase/supabase-js` + TanStack Query. Zod at the boundary (RPC payloads, deep-link params) |
| Session storage (Sprint 3) | `expo-secure-store` (token) / AsyncStorage (query cache persistence) |
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
      dev/ui.tsx        design-system gallery (dev builds only)
      +not-found.tsx
      # upcoming: classes/[id].tsx, activities/[slug].tsx, coaches/[slug].tsx,
      #   news/[slug].tsx, pass/index.tsx, pass/offer.tsx, invite/[token].tsx,
      #   guest/index.tsx, settings/*.tsx
    components/
      ui/               primitives: Text, Button, IconButton, Chip, Badge, Card,
                        Screen, ScreenHeader, SectionHeader, Skeleton, EmptyState,
                        PressableScale, FadeIn, Icon
      cards/            ClassCard, MediaCard (+ NewsCard, CoachCard, GuestPassCard…)
      brand/            Logo (official file only)
      navigation/       TabBar
    features/           (Sprint 2+) one folder per domain: planning/, activities/,
                        news/, profile/, guest-pass/, reminders/
                        each with api.ts (queries), hooks.ts, components/
    i18n/               index.ts, locales/{fr,en,ar}.ts, typed keys
    lib/                haptics, date/time formatting (club timezone), supabase client
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
(tested against Postgres 16 with RLS smoke tests). Seed:
`supabase/seed.sql` (the real coach roster: 7 coaches, 19 activities, 28
coach↔activity links).

| Area | Tables |
| --- | --- |
| Identity | `profiles` (kind: visitor / guest / member), `admin_users` (admin / reception) |
| Membership | `memberships` (plan name, type, validity; managed by admins) |
| Catalogue | `coaches`, `activities`, `coach_activities`, `rooms` |
| Planning | `class_sessions` (concrete dated sessions, visibility, cancellation) |
| Preferences | `favorite_activities`, `class_reminders`, `notification_preferences`, `device_tokens` |
| Content | `news`, `notifications` (admin push campaigns, simple targeting) |
| Guest passes | `guest_pass_balances`, `guest_invitations`, `guest_passes`, `guest_redemptions`, view `guest_pass_availability` |
| Config | `app_settings` (key/value jsonb; `is_public` exposes it to apps) |

Changes from the suggested entity list, and why:

* **`rooms`** was added so the planning filters and admin pickers don't depend on free text.
* **`class_reminders`** was added. Reminders fire locally on the device, but the backend
  must know who follows a session to warn them when it moves or is cancelled.
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

### Guest-pass flow (Sprints 5–6)

1. Member → `create_guest_invitation(invitee_name)` → checks availability → returns the raw
   link token once → `https://<domain>/invite/<token>` shared via the native share sheet.
2. Invitee opens the link. With the app installed, a universal/app link goes to `invite/[token]`.
   Without it, a web landing page shows store buttons and a short code to paste after install.
3. App → `activate_guest_invitation(token)` (anonymous session) → profile becomes `guest`, a
   `guest_passes` row is created with a **different** QR token (raw value kept in SecureStore,
   re-issuable via `rotate_guest_pass_qr()`).
4. Reception → `check_guest_pass(qr)` (read-only verdict: valid / invalid / expired / used /
   cancelled + sponsor, expiry) → `redeem_guest_pass(qr)` inserts into `guest_redemptions`
   (unique per pass, so double use is impossible even with concurrent scans) and sets status `used`.

## 5. Phased plan

| Sprint | Scope | Exit criteria |
| --- | --- | --- |
| 1 ✅ | Workspace, Expo Router, tokens, typography, i18n, tab navigation, logo slot, UI primitives, cards, skeletons, empty states, schema and seed | `tsc` clean, web/Android bundle exports, UI kit renders with no console errors |
| 2 | Home, Planning (week selector + filters), Class detail, Activities, Coaches, News list/detail, Profile. Typed local fixtures based on the real roster | All screens navigable with realistic data, plus loading and empty states |
| 3 | Supabase client, anonymous session bootstrap, member login (email OTP), TanStack Query data layer, generated DB types, swap fixtures for live data | App runs against a Supabase project, and RLS is verified from the client |
| 4 | Reminders (local scheduling, 15/30/60/120 min, server mirror), push token registration, notification preferences, schedule-change pushes (Edge Function) | Reminder fires on device, and a changed session re-notifies followers |
| 5 | Guest-pass RPCs, offer/share flow, invitation list and states, deep links, Guest Mode gating | End-to-end: member shares → guest activates → QR shown |
| 6 | Admin app scaffold and auth, `/reception/scanner`, check/redeem RPCs | A pass can't be redeemed twice. All verdict screens done |
| 7 | Admin CRUD: planning (duplicate session/week), coaches (photo upload), activities, news (publish/unpublish), notifications, members, guest passes, settings | Admin changes show up in the app |
| 8 | Tests (RLS/pgTAP, RPC, component), error boundaries, performance, a11y pass, security review, EAS builds | Release candidates for Android and iOS |

## 6. Risks and decisions to confirm

1. **Official logo and brand color were not supplied.** The `Logo` component shows a
   neutral "LOGO" placeholder and never an imitation. `colors.primary` (#C6F432) is
   provisional. App icon and splash are still Expo placeholders. *Needed before Sprint 2 sign-off.*
2. **Invitation links when the app is not installed.** Neither OS carries a deep link
   through an App Store install. Proposed: a small web landing page on the club domain
   (served by the admin Next.js app) with store links and a short invitation code the
   guest enters once in the app. Universal/App Links need a domain we control
   (`apple-app-site-association`, `assetlinks.json`). *Needs: the domain to use.*
3. **Anonymous auth for every install.** Proposed so that favorites, reminders, push
   tokens and Guest Mode all key off a real `auth.uid()` without forcing sign-up.
   Caveat: when an existing member logs in, the anonymous user's favorites are copied
   over by the app rather than merged by Supabase.
4. **How members get accounts.** There is no link to the club's membership system. Proposed:
   admins create or import members (email or phone), and members sign in with an OTP.
   *Confirm email vs. phone (SMS cost) and who keeps membership expiry up to date.*
5. **Timezone.** Planning is stored as `timestamptz` and shown in club time
   (`Africa/Casablanca`, assumed from context). *Confirm the club location.*
6. **Recurring schedule.** The MVP stores concrete sessions, and the admin duplicates days
   or weeks. Recurrence rules (RRULE) were left out to keep editing and cancellations simple.
7. **Remote push needs a development build.** Expo Go can't receive remote push, so EAS
   development builds are needed from Sprint 4.
8. **Admin app in the same workspace.** Next.js and React Native must agree on the hoisted
   `react` version (19.3.0 today). If they drift, the admin app gets its own install
   (`installConfig`/nohoist) instead.
9. **Durations and extra rooms in the seed** (only "Studio Cycling" was given) are
   placeholders, marked as such in `seed.sql`.
10. **Arabic translations** are a draft and need a native review. RTL layout gets QA'd
    before AR ships. The app is pinned to French until then.
