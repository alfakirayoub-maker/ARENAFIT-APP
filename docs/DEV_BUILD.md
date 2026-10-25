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

### Reception check-in checklist (guest scans the printed QR)

Print the station QR (`node scripts/reception/station-qr.mjs 'AFR1.…' out.svg`) in two sizes
(≈ 8 cm and ≈ 15 cm). On at least one iPhone and one Android phone:

1. « Utiliser mon Pass » › « Scanner le QR » → camera permission explained, then the OS prompt;
   deny once → « Caméra désactivée » + « Ouvrir les réglages » works.
2. Camera opens quickly; QR recognised at 20 cm, 50 cm and 1 m, in normal and low light.
3. Valid QR → « PASS VALIDÉ » readable by staff at arm's length; live clock ticking.
4. Scan again → « Pass déjà utilisé » with the time; no second redemption in the DB.
5. Deactivated station QR → « QR désactivé »; rotated (old) QR → « QR Arena Fit invalide ».
6. A random QR / URL / invitation link → « QR Arena Fit invalide », nothing opens.
7. Airplane mode while scanning → « Erreur réseau »; retry online → validated (or already used).
8. Expired pass → « Pass expiré »; guest without pass → « Aucun Pass disponible ».
