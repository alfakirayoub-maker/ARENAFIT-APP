# Development builds & notifications

Native notifications only work in a **development build** (or a release build) —
not in a web browser, and not reliably in Expo Go. Nothing in this document
requires credentials to be committed: EAS stores them, local builds read them
from your machine.

## One-time setup

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init          # creates the EAS project, writes expo.extra.eas.projectId to app.json
```

`projectId` is not secret, but it is created by your Expo account — commit the
`app.json` change `eas init` makes.

Create `apps/mobile/.env.local` from `.env.example` (Supabase URL + anon key).
For EAS cloud builds, set the same `EXPO_PUBLIC_*` values as EAS environment
variables (`eas env:create`), never the service-role key.

## Android

```bash
# Cloud build (no Android Studio needed) — installable APK
npx eas-cli@latest build --profile development --platform android

# or local build on a machine with Android SDK + a device/emulator
npx expo run:android
```

Then `npm run start` (in `apps/mobile`) and open the project from the dev build.

Credentials: EAS generates and stores the upload keystore on the first build.
Keep using EAS-managed credentials; never commit a `.jks`.

## iOS

Requires an **Apple Developer Program** membership.

```bash
npx eas-cli@latest device:create                        # register test iPhones (internal distribution)
npx eas-cli@latest build --profile development --platform ios
# Simulator build (no device / provisioning needed):
npx eas-cli@latest build --profile development-simulator --platform ios
# or locally on a Mac with Xcode:
npx expo run:ios
```

Credentials (managed by EAS when you sign in with your Apple account):
distribution certificate and provisioning profiles. The generated
entitlements include `aps-environment` (from expo-notifications); it is needed
for remote push later, not for local reminders.

## Notification configuration (already in the repo)

| What | Where |
| --- | --- |
| expo-notifications config plugin: small icon, accent color `#80B918`, default channel `class-reminders` | `apps/mobile/app.json` |
| Android small icon — the Arena Fit triangle mark cropped from the official logo, white on transparent (Android requires monochrome) | `apps/mobile/assets/notifications/notification-icon.png` |
| Android channel "Cours & rappels" (importance high), created before asking permission and before scheduling | `src/features/reminders/platform-scheduler.ts` |
| Foreground presentation (banner + sound), tap routing (cold start / background / foreground) | `platform-scheduler.ts`, `src/features/notifications/NotificationRouter.tsx` |

Android delivery: reminders use `delivery: 'bestEffort'`
(`setExactAndAllowWhileIdle`). We do **not** request `SCHEDULE_EXACT_ALARM` /
`USE_EXACT_ALARM` (Play policy reserves them for alarm/calendar apps), so
aggressive OEM battery savers may deliver a reminder a few minutes late —
verify on the Android phones the club's members commonly use.

## Credentials needed later (remote push — not used yet)

| Platform | Credential | Where it goes |
| --- | --- | --- |
| Android | Firebase project + **FCM v1 service account key** (JSON) | Uploaded to EAS (`eas credentials`), never committed |
| iOS | **APNs key** (.p8) from the Apple Developer account | Uploaded to EAS, never committed |
| Server | **Expo access token** for the Push API | Supabase Edge Function secret only |

## Manual test checklist (physical devices)

Run on at least one Android 13+ phone and one iPhone:

1. Fresh install → app opens without any permission prompt.
2. Class › Me le rappeler › 15 min → explanation sheet → OS prompt → allow →
   "Rappel activé". Use a class ~20 min away to receive it quickly.
3. Notification arrives with title "RPM dans 15 min" and the Arena Fit icon
   (Android: white mark tinted green).
4. Tap it with the app killed (cold start), in background and in foreground →
   Class Details of that exact class.
5. Modify the offset → still a single pending notification
   (Android: `adb shell dumpsys alarm | grep -i arenafit`).
6. Deny permission on a second device → "Notifications désactivées" →
   "Ouvrir les réglages" opens the app's system settings; no re-prompt.
7. Move the class in Supabase (e.g. 18:00 → 19:00), bring the app to the
   foreground → toast "… est désormais à 19:00 · rappel mis à jour"; the
   notification fires 30 min before 19:00, not 18:00.
8. Cancel / unpublish the class → toast, notification never fires.
9. Profil › Notifications › Cours & rappels off → no notification fires;
   back on → pending reminders return.
10. Reboot the phone → pending reminders still fire (Android reschedules
    after boot via expo-notifications).
11. Device set to another timezone (e.g. Europe/Paris) → reminder still fires
    relative to the club time shown in the app.

## Guest Pass on devices (Sprint 5)

* Branch: set `EXPO_PUBLIC_BRANCH_KEY`, `EXPO_PUBLIC_BRANCH_DOMAIN`,
  `EXPO_PUBLIC_BRANCH_ALTERNATE_DOMAIN` as EAS environment variables, then build — see
  `docs/BRANCH.md` for the dashboard setup and the device checklist (deferred deep linking is
  not verified until that checklist passes).
* Native share sheet and « Envoyer sur WhatsApp » (`https://wa.me/?text=…`) only behave for
  real on devices; the web preview copies the message instead.
* SecureStore holds only the member's own invitation links. Guests store no secret; their
  session (AsyncStorage) identifies the pass. Uninstalling signs a guest out (MVP limitation).

## Reception check-in — device builds (Sprint 6)

### Backend the phone can reach

A phone can't reach `localhost`. Use either a Supabase **staging** project
(`supabase db push` + `supabase/seed.sql`, enable anonymous sign-ins) or the
local stack on your LAN (`scripts/local-stack/up.sh`, then use
`http://<your-computer-LAN-IP>:54321` as the URL). Create a station and print it
(docs/RECEPTION.md). Never put the service-role key in the app or in EAS env.

### Commands

```bash
cd apps/mobile
npx eas-cli@latest login                       # once
npx eas-cli@latest init                        # once: links the EAS project

# Public config for the build (EAS environment "development"; values are not secret)
npx eas-cli@latest env:create --environment development --name EXPO_PUBLIC_SUPABASE_URL --value https://<staging>.supabase.co
npx eas-cli@latest env:create --environment development --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key>

# Android: installable APK with the dev client
npx eas-cli@latest build --profile development --platform android
# iOS: register test iPhones once, then build (Apple Developer account needed)
npx eas-cli@latest device:create
npx eas-cli@latest build --profile development --platform ios

# Then on your computer, and open the project from the dev client app:
npx expo start --dev-client
```

Local alternative (machine with Android SDK / Xcode): `npx expo run:android`,
`npx expo run:ios --device`.

### Configuration verified in the repo (no device needed)

`npx expo prebuild --no-install --clean` (run in Sprint 6, generated folders
discarded) produced:

* Android `AndroidManifest.xml`: `android.permission.CAMERA`; **no** `RECORD_AUDIO`.
* iOS `Info.plist`: `NSCameraUsageDescription` = « Arena Fit utilise la caméra
  uniquement pour scanner le QR affiché à la réception et valider votre Pass
  Invité. »; **no** microphone usage string.
* `expo-camera` plugin with `barcodeScannerEnabled: true` (ML Kit on Android,
  AVFoundation on iOS).

Not verified here: an actual build (no Android SDK, no Xcode, no Expo/Apple
credentials in this environment).

### Device test matrix

Print the A5 and A6 assets of a test station. Tick each row on one Android
phone and one iPhone.

| # | Scenario | Expected | Android | iPhone |
| --- | --- | --- | --- | --- |
| 1 | First « Scanner le QR » (permission never asked) | explanation → « Autoriser la caméra » → OS prompt | ☐ | ☐ |
| 2 | Permission denied | « Accès à la caméra désactivé », no new prompt, rest of the app works | ☐ | ☐ |
| 2b | iOS restricted (Screen Time) / Android « Don't ask again » | same denied view, « Ouvrir les réglages » | ☐ | ☐ |
| 3 | « Ouvrir les réglages » → allow → back to app | scanner appears without restarting | ☐ | ☐ |
| 4 | Camera opens | < 1 s, frame visible, close (×) works | ☐ | ☐ |
| 5 | A5 print at ~30 cm | recognised < 1 s | ☐ | ☐ |
| 6 | A6 print at ~30 cm | recognised < 1 s | ☐ | ☐ |
| 7 | A5 print at ~1 m | recognised | ☐ | ☐ |
| 8 | Normal indoor light | recognised | ☐ | ☐ |
| 9 | Low light | recognised (torch if needed) | ☐ | ☐ |
| 10 | Torch toggle | turns on/off; off when leaving the screen | ☐ | ☐ |
| 11 | Portrait only | layout correct, no rotation glitches | ☐ | ☐ |
| 12 | Random QR / URL / invitation link | inline « QR non reconnu », scanning continues, nothing opens | ☐ | ☐ |
| 13 | Airplane mode, valid QR | « Vérification du Pass… » then « Connexion impossible », pass not used | ☐ | ☐ |
| 14 | Network back → « Réessayer » | PASS VALIDÉ (or « déjà utilisé » if the first call went through) | ☐ | ☐ |
| 15 | Hold the QR in view after success | one redemption only (check `guest_redemptions`) | ☐ | ☐ |
| 16 | Scan again with a used pass | « PASS UTILISÉ / Validé le … à … » | ☐ | ☐ |
| 17 | Expired pass | « Pass expiré » | ☐ | ☐ |
| 18 | Deactivated station | « Ce QR n’est plus actif » | ☐ | ☐ |
| 19 | Rotated station, old print | « QR Arena Fit invalide »; new print works | ☐ | ☐ |
| 20 | Background/foreground during scan and on PASS VALIDÉ | resumes correctly; clock catches up | ☐ | ☐ |
| 21 | Kill & reopen within 2 min of success | live PASS VALIDÉ (server time) | ☐ | ☐ |
| 22 | Kill & reopen after 2 min | PASS UTILISÉ + server time, no green state | ☐ | ☐ |
| 23 | Stay on PASS VALIDÉ for 2 min | switches by itself to PASS UTILISÉ | ☐ | ☐ |
| 24 | Phone clock set wrong (manual time) | same results as 21–23 | ☐ | ☐ |
| 25 | Staff readability | « PASS VALIDÉ » readable at arm's length, max brightness | ☐ | ☐ |

### Web simulator (development only)

On web (and in dev builds) the scan screen shows « Simulation scanner (dev) »:
valid station, deactivated station, network cut (valid QR whose request fails
once, so « Réessayer » can be tried), unknown station, non-Arena Fit code,
random URL. It is never in release bundles (`npm run check:release`,
`tests/release-guards.test.mts`). It is not evidence that native scanning works.
