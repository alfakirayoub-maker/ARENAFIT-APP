# Arena Fit — Technical architecture

Status: Sprint 4 (class reminders & notification infrastructure) done, awaiting review. This document is the reference for the
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
│  SECURITY DEFINER RPCs: guest invitations, check-in      │
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
| Session (Sprint 5) | One session-capable Supabase client (`src/features/auth/`), anon key only. Auth session persisted in AsyncStorage; the member's own invitation links in `expo-secure-store`. Guests keep nothing but their session. No user exists until « Activer mon Pass » (guest) or a member signs in |
| Config | `src/config/env.ts`: `EXPO_PUBLIC_*` variables (Branch key + domains, invite base URL, Supabase). See `.env.example`. `app.config.ts` adds the Branch plugin, associated domains and Android app links only when they are set |
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
      pass/index.tsx  pass/offer.tsx  pass/[id].tsx   Pass & Invitations, Offrir un Pass, invitation detail (members)
      invite/[token].tsx  invite/code.tsx              invitation preview + activation, short-code fallback
      guest/pass.tsx  guest/scan.tsx   « Utiliser mon Pass » (how to), scanner + PASS VALIDÉ
      +native-intent.tsx  validates every incoming URL (invitation links)
      settings/notifications.tsx  settings/account.tsx  help.tsx  login.tsx
      dev/ui.tsx        design-system gallery (dev builds only)
      +not-found.tsx
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
| Guest passes | `guest_pass_balances`, `guest_invitations`, `guest_passes`, `guest_redemptions`, `guest_pass_events`, `guest_code_attempts` (see §9) |
| Config | `app_settings` (key/value jsonb; `is_public` exposes it to apps) |

Changes from the suggested entity list, and why:

* **`rooms`** was added so the planning filters and admin pickers don't depend on free text.
* **`class_reminders`** was added. Reminders fire locally on the device. For signed-in
  users the backend can also know who follows a session, to warn them when it moves or is
  cancelled. Visitors' reminders stay on the device only.
* **`notification_preferences`** was added as its own table, separate from `profiles`.
* **Guest-pass "available" is computed, not stored.** Availability = allowance −
  invitations still holding a pass (`private.available_passes()`, §9). Stored
  invitation statuses: `sent, activated, used, expired, cancelled, converted`.
* **Translations**: content tables carry an `i18n jsonb` column
  (`{ar:{…}, en:{…}}`) next to the French source columns.

### Security model (RLS)

* Catalogue, visible sessions, published news and public settings are readable by `anon`.
* Personal tables are owner-only. `profiles.kind` is not user-updatable (column grants).
* `members`-visibility sessions need `is_member()`. Admin writes need `is_admin()`.
* Guest tables have **no client write policies**. Every mutation goes through
  `SECURITY DEFINER` RPCs that validate state transitions.
* Tokens: invitation link and reception station tokens are 256-bit random values. Only `sha256(token)` is stored.

### Identity model

* **Visitors** (default) browse Planning, Activities, Coaches, News and club information
  with **no Supabase user**. Favorites, reminders and notification preferences live on the
  device.
* **Guests** get a Supabase identity (anonymous user) only when they tap « Activer mon
  Pass » — never on install or launch. `IdentityService` (`src/features/auth/identity.ts`)
  is the only code that calls Supabase Auth.
* **Members**: the activation and sign-in flow is not decided yet. The auth layer must
  support phone-based sign-in for members imported by the club. Release builds have no
  member sign-in, so they only ever hold visitor or guest sessions. Development builds can
  show a demo member (fixtures, no backend) or sign in a local test member
  (`src/features/session/dev-provider.ts`, excluded from release bundles). No membership
  sync is built.

### Guest-pass flow

Implemented in Sprint 5 (invitation → share → activation → guest scans the reception QR →
redemption) — see §9. There is no reception-side scanner.

## 5. Phased plan

| Sprint | Scope | Exit criteria |
| --- | --- | --- |
| 1 ✅ | Workspace, Expo Router, tokens, typography, i18n, tab navigation, logo slot, UI primitives, cards, skeletons, empty states, schema and seed | `tsc` clean, web/Android bundle exports, UI kit renders with no console errors |
| 2 ✅ | Home, Planning (week selector + filters), Class detail, Activities, Coaches, News list/detail, Profile, Pass & Invitations UI, local reminders/favorites. Dev fixtures based on the real roster | All screens navigable with realistic data, plus loading, empty and error states |
| 3 ✅ | Supabase repositories for coaches, activities, planning and news (no login), controlled club clock, image storage, pgTAP RLS/seed/clock tests, cache strategy, release-bundle check | App runs against Supabase as a visitor, RLS verified in SQL and over HTTP |
| 4 ✅ | Native local reminders (15/30/60/120 min) via a platform-independent ReminderService, contextual permission UX, reconciliation with the live planning, notification tap routing, Android channel + monochrome icon, notification preferences, push interface (not wired), EAS dev-build profiles | Logic covered by tests; device behaviour per docs/DEV_BUILD.md checklist |
| 5 ✅ | Guest-pass server operations, offer/share flow, InvitationLinkService (Branch + local), short-code fallback, invitation states, cancellation/expiry, Guest Mode, guest check-in by scanning the reception QR | End-to-end on web against local Supabase; Branch/device checks listed in docs/BRANCH.md |
| 6 | Guest reception check-in hardening, native scanner quality, reception station management backend, real-device validation | Checklist in docs/DEV_BUILD.md passes on iPhone + Android |
| 7 | Admin CRUD: planning (duplicate session/week), coaches (photo upload), activities, news (publish/unpublish), notifications, members, guest passes, settings | Admin changes show up in the app |
| 8 | Tests (RLS/pgTAP, RPC, component), error boundaries, performance, a11y pass, security review, EAS builds | Release candidates for Android and iOS |

## 6. Risks and open points

1. **App icon and splash** are still Expo placeholders. The official logo is in use
   in the app (`assets/brand/arena-fit-logo.png`, unmodified), and the Android notification
   icon is the logo's triangle mark. A square app-icon export of the brand is still needed.
2. **No photography yet.** Image slots exist everywhere (`imageUrl` / `coverUrl` / `photoUrl`).
   Until club photos are uploaded, `Artwork` shows a category-tinted placeholder.
3. **Branch setup** needs a Branch account and the final link domain; everything else is
   wired behind env variables (docs/BRANCH.md). Deferred deep linking is **not verified**
   until tested on real devices with real store installs.
4. **Member authentication** is pending your decision. The `AuthProvider` boundary
   (`src/features/session/`) is ready for it.
5. **Device-only verification pending.** Native delivery, tap routing (cold start, background,
   foreground), the Android channel, OEM battery-saver delays and reboot persistence need the
   physical-device checklist in `docs/DEV_BUILD.md`. Web only previews the flow.
6. **Activity categories** of club-specific formats are inferred from names. They're flagged
   for club review in `seed.sql`.
7. **Recurring schedule.** The MVP stores concrete sessions, and the admin duplicates days
   or weeks.
8. **Admin app in the same workspace.** Next.js and React Native must agree on the hoisted
   `react` version. Otherwise the admin app gets its own install.
9. **Arabic translations** are a draft and need a native review. RTL layout gets QA'd
   before AR ships. The app is pinned to French until then.
10. **Guest Pass rules** are settings (`app_settings`, §9): 3 passes, 15 days, 1 visit,
    pass returned when an invitation expires unused. Admin editing comes with the dashboard.

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

## 8. Class reminders & notifications (Sprint 4)

```
UI (ReminderSheet, ClassCard, Class Details, settings)
  → hooks (src/features/reminders/hooks.ts: useReminder, useNotificationPermission, ReminderSync)
    → ReminderService (service.ts — platform independent, unit-tested under Node)
      → NotificationScheduler
          platform-scheduler.ts      expo-notifications (iOS / Android)
          platform-scheduler.web.ts  simulated, nothing delivered (web preview)
```

* **Records** (`arenafit:class-reminders.v2`): one per session, including session id,
  activity id/slug, title and coach snapshot, club date and start time, offset, the trigger
  instant (via `clubInstant()`), the native notification id, and created/updated times. Every
  mutation is serialised, so concurrent taps can't create duplicates.
* **Availability:** no reminder for cancelled, in-progress or finished classes. Only offsets
  whose trigger is still in the future are shown.
* **Permission:** never requested at startup. Choosing an offset when undetermined opens a
  short explanation, then one OS prompt. A refusal opens a "Notifications désactivées" sheet
  with "Ouvrir les réglages" and no re-prompt.
* **Reconciliation** runs on launch, on foreground (throttled to 30 s) and after a planning
  pull-to-refresh:
  * moved class: cancel and re-schedule;
  * cancelled, deleted or unpublished class: remove;
  * class started: remove;
  * class moved so early the reminder time has passed: remove;
  * snapshot changed or the OS lost the notification: refresh;
  * reminder already fired: left untouched;
  * planning unavailable: nothing is cancelled.

  Orphaned OS class reminders are cancelled, and the user gets a toast for each moved or
  removed reminder.
* **Notification:** title "RPM dans 30 min", body "Votre séance avec ANAS D commence à 18:00
  chez Arena Fit." Payload `{ type: 'class-reminder', sessionId }`. Taps go through
  `routeForNotificationData` (a whitelist, never a raw URL) to `/classes/[id]?from=reminder`.
  If the class is gone, the app opens Planning with a toast.
* **Android:** one channel, `class-reminders` ("Cours & rappels", high importance). The small
  icon is the white logo mark, tinted `#80B918`. Delivery is `bestEffort`, with no
  exact-alarm permission.
* **Preferences** (Profil › Notifications): "Cours & rappels" works. Turning it off cancels
  OS notifications but keeps reminders, and turning it on restores them. News, Offres &
  événements and Changements de planning are saved choices for future remote push, labelled
  "Bientôt".
* **Remote push:** `src/features/notifications/push.ts` documents the interface and flow
  only. No token collection, endpoint or sending yet.
* **Dev builds:** `apps/mobile/eas.json` profiles, steps and credentials in `docs/DEV_BUILD.md`.

## 9. Guest Pass (Sprint 5)

### Lifecycle

```
[available] ─create──▶ sent ──activate──▶ activated ──guest scans reception QR──▶ used ──(later)──▶ converted
               │            │                 │
               │            ├─cancel─▶ cancelled      (pass returned to the balance)
               │            └─expiry─▶ expired ◀──────┘  (unused at expires_at: pass returned)
```

* "available" is not a row: it is `allowance − invitations still holding a pass`. Each
  invitation has `pass_returned`, set in the same UPDATE that cancels/expires it, so a pass
  can never come back twice.
* `cancelled` only from `sent`; `activated/used/converted` can't be cancelled.
* Expiry applies to `sent` and `activated` (not yet used) invitations at `expires_at`
  (= creation + `invitation_validity_days`); the guest pass shares that date.
* `converted` is set by staff later; nothing detects it automatically.

### Data model (migration `20261026000000_guest_pass_flow.sql`)

Extends the Sprint 1 tables rather than duplicating them:

| Table / column | Purpose |
| --- | --- |
| `guest_pass_balances.allowance` | passes granted (default from `guest_pass.default_allowance`, row created lazily for eligible members) |
| `guest_invitations` + `short_code_hash`, `expires_at`, `pass_returned`, `used_at`, `expired_at`, `last_shared_at`, `link_rotated_at` | one row per offered pass; hashes of the share token and short code; timestamps per state; DB checks tie states to timestamps |
| `guest_passes` | the activated pass (guest, sessions, valid until) — no secret: the guest's session identifies it |
| `reception_stations` | `name`, `token_hash` (unique), `active`, `last_rotated_at` — one per printed reception QR; more can be added without app changes |
| `guest_redemptions` | one row per used pass (`unique(guest_pass_id)`), `guest_profile_id`, `reception_station_id`, `redeemed_at` |
| `guest_pass_events` | `gift_created, gift_shared, link_rotated, invitation_opened, gift_activated, gift_cancelled, gift_expired, reception_qr_scanned, guest_pass_redeemed` (+ station) — funnel created→activated→used→converted is computable |
| `guest_code_attempts` | failed short-code lookups (rate limiting) |
| `profiles.show_name_on_invitations` | whether the inviter's first name appears on previews |
| `app_settings` | `guest_pass.invitation_validity_days` (15), `sessions_per_pass` (1), `refund_expired_unused` (true), `daily_invitation_limit` (10), `code_attempts_limit` (10) / `code_attempts_window_minutes` (15) |

### Server operations (SECURITY DEFINER, `search_path = ''`)

| Function | Who | What |
| --- | --- | --- |
| `create_guest_invitation(name)` | eligible member | locks the member's balance row (`FOR UPDATE` → concurrent taps queue), applies expiry, checks balance / daily limit / config, generates token + code server-side, stores hashes, returns raw values **once** |
| `get_my_guest_invitations()` | member | balance + own invitations |
| `reshare_guest_invitation(id)` | member, `sent` only | new link + code (raw values are not stored, so "share again" from another device rotates them) |
| `record_guest_invitation_shared(id)` | member | share-sheet completed (analytics) |
| `cancel_guest_invitation(id)` | member, `sent` only | cancels and returns the pass atomically |
| `preview_guest_invitation(token, code)` | anon + authenticated | public preview by secret only: result + inviter first name (if allowed) + sessions + date. No ids, no invitee data |
| `activate_guest_invitation(token, code)` | guest identity | locks guest + invitation; idempotent: same guest → existing pass, other guest → `already_claimed`; members/inviter refused; one active pass per guest |
| `get_my_guest_pass()` | guest | current pass (active first), with redemption time + station once used |
| `redeem_my_guest_pass(reception_qr)` | guest | check-in, see below |
| `create_reception_station(name)` / `rotate_reception_station_token(id)` / `set_reception_station_active(id, bool)` | **service_role only** | returns the printable `AFR1.<token>` once; rotation revokes the old print |
| `expire_guest_invitations()` | **service_role only** | scheduled job; idempotent |

`EXECUTE` is revoked from `public/anon/authenticated` and granted per function. Expiry is also
applied lazily by every operation, so correctness never depends on the job.

**Scheduler.** If `pg_cron` is enabled when the migration runs, it schedules
`expire-guest-invitations` every 15 minutes. Otherwise enable pg_cron in the Supabase
dashboard and run:
`select cron.schedule('expire-guest-invitations', '*/15 * * * *', 'select public.expire_guest_invitations()');`

### Reception check-in (the guest scans; reception needs no device)

```
Guest Mode › « Utiliser mon Pass » › « Scanner le QR » › camera › printed reception QR (AFR1.<station token>)
   → redeem_my_guest_pass(qr)   [session = the guest; no guest/pass id is ever sent]
   → PASS VALIDÉ · Bienvenue chez Arena Fit · Séance invitée · date · heure · station (live clock)
```

`redeem_my_guest_pass` runs in one transaction: caller must be a guest identity → lock the
guest's profile row (concurrent scans queue) → QR must match `^AFR1\.[A-Za-z0-9_-]{43}$` →
station found by token hash → station active → the guest's pass (active first) locked → not
expired (expires it if due) → not already used (`already_used` + original time) → insert
`guest_redemptions` (unique per pass) + status `used` + `used_at` → events
`reception_qr_scanned` and `guest_pass_redeemed`. Results: `redeemed | already_used | expired |
no_pass | invalid_qr | station_inactive | not_guest`.

**Security model.** The reception QR proves nothing about access — only that the request came
from someone who saw that printed code. A visit needs all three: a valid active station QR +
the authenticated guest session + that guest's own active, unused pass. The app validates the
QR shape before calling the server and never opens a scanned URL.

**Known MVP limitation (static QR).** A photo of the printed QR could be scanned away from the
club. Impact is limited: it still needs a guest identity holding an active one-use pass, and
burns that pass. No GPS/geofencing or rotating QR now; `rotate_reception_station_token` and
per-station `active` allow rotation (e.g. monthly, or after a leak) without app changes.

**Printing.** `select public.create_reception_station('Réception principale');` (or
`rotate_reception_station_token`) in the Supabase SQL editor → copy `qr_payload` (shown once)
→ `node scripts/reception/station-qr.mjs 'AFR1.…' reception.svg` → print ≥ 8 cm wide.

### Secrets

| Secret | Generated | Stored server-side | Where the raw value lives |
| --- | --- | --- | --- |
| Share token (link) | server, 256-bit, base64url | `sha256` only | the share message; the member's device (SecureStore) |
| Short code `AF-XXXX-XXXX` | server, 8 chars from a 31-char alphabet without look-alikes (≈39.6 bits, rejection sampling) | `sha256` of the normalised code | share screen / invitation detail of the member |
| Station token | server (create / rotate), 256-bit | `sha256` only | the printed QR only |

The guest stores **no secret**: the persisted auth session is enough to find and redeem their
pass (the removed guest-QR token is gone with its storage). Uninstalling still signs the guest
out (anonymous identity), which is the remaining device-loss limitation.

**Enumeration / abuse.** Ids grant nothing (all reads by secret through functions; hashes are
not selectable through column grants). Failed short-code lookups are rate limited per client
(user id, else `x-forwarded-for` from the Supabase gateway): 10 failures / 15 min. With ~2^39.6
codes, guessing a live code is impractical. Station tokens are 256-bit. Local limits: the local
stack's gateway sets the forwarded address itself; on Supabase the header comes from its API
gateway. Add an edge rate limit before launch for defence in depth.

### Access control (RLS + grants)

* anon: no access to any guest table (permission denied), only `preview_guest_invitation`.
* members: read their own invitations/balance (no hash columns); no writes.
* guests: read their own pass; no writes; redeem only their own pass through `redeem_my_guest_pass`.
* `reception_stations`: no client access at all (permission denied); managed by service role.
* staff (`is_staff`) can read for support; admin UI comes later.

### App

```
src/features/auth/        IdentityService (only caller of Supabase Auth), session client, member profile
src/features/guest-pass/  types, Supabase repository (RPC + Zod), hooks (TanStack),
                          links.ts (pure validation: tokens, codes, Branch payloads, URLs, reception QR),
                          scanner/ReceptionScanner(.web).tsx (expo-camera, QR only / web stand-in),
                          link-service.ts (InvitationLinkService: Branch + local adapters),
                          link-runtime(.web).ts (composition), share(.web).ts, components/
src/app/+native-intent.tsx  every incoming URL → validated app path
```

* Identity is created in `useActivateInvitation()` only; if the claim fails, a freshly created
  identity is signed out again.
* Expo Router stays the navigation source of truth: link adapters only report validated
  invitations; `InvitationLinkListener` pushes `/invite/<token>`.
* Guest Mode: Accueil starts with « Votre Pass Arena Fit » then the normal content; Profil
  shows « Mon Pass Invité » and « Quitter le mode invité ». The scanner is reachable only in
  Guest Mode with an activated pass; dev builds add a scan simulator (`src/dev/ScanSimulator.tsx`,
  excluded from release) injecting valid / deactivated / invalid / URL payloads. Member-only routes (`/pass*`)
  redirect; no subscription, sending, rewards or admin for guests.
* Release bundles: `npm run check:release` fails on dev fixtures, the demo/test member, dev
  credentials, dev reception QR payloads, the scan simulator, test tokens, Branch test keys or
  the service-role key.

### Local stack & tests

* `scripts/local-stack/up.sh`: PostgreSQL + GoTrue (real anonymous sign-in) + PostgREST + gateway
  on :54321, test members, an active and a deactivated reception station, a printable SVG of the
  local reception QR; secrets in `.local-stack/` (git-ignored).
* `supabase/tests/guest_pass.test.sql` (pgTAP, 96 checks incl. check-in and rotation) and
  `apps/mobile/tests/guest-pass.integration.test.mts` (real API: concurrency, idempotency,
  RLS), `apps/mobile/tests/guest-pass-links.test.mts` (payload/URL validation).
