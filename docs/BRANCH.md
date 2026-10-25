# Invitation links & Branch (deferred deep linking)

Guest Pass invitations are shared as a **link**. With Branch configured, the link
survives an App Store / Play Store install: the friend taps it, installs Arena
Fit, opens it, and lands on the invitation. Without Branch (development, web
preview), links are plain `…/invite/<token>` URLs and the short code is the
fallback.

Nothing Branch-specific is committed: no key, no domain.

## Configuration

| Variable (`apps/mobile/.env.local` / EAS env) | Example | Notes |
| --- | --- | --- |
| `EXPO_PUBLIC_BRANCH_KEY` | `key_live_…` | Live **public** key. `key_test_…` only in dev builds (release check rejects it) |
| `EXPO_PUBLIC_BRANCH_DOMAIN` | `arenafit.app.link` | Primary link domain (or custom domain) from the Branch dashboard |
| `EXPO_PUBLIC_BRANCH_ALTERNATE_DOMAIN` | `arenafit-alternate.app.link` | Alternate domain |
| `EXPO_PUBLIC_INVITE_BASE_URL` | `https://staging.example` | Only when Branch is not used: links become `${base}/invite/<token>` |

When key **and** domain are set, `app.config.ts` adds:

* `@config-plugins/react-native-branch` (native SDK init, keys in Info.plist / AndroidManifest),
* iOS `associatedDomains`: `applinks:<domain>` for both domains,
* Android `intentFilters` with `autoVerify` for both domains.

Branch needs a **development or release build** (`npx eas-cli build --profile development`),
not Expo Go and not the web preview.

## Branch dashboard setup (one time)

1. Create the Arena Fit app in Branch; copy the live key and link domains.
2. iOS: bundle id `com.arenafit.app`, Apple Team ID, enable Universal Links. Branch hosts the
   `apple-app-site-association` file.
3. Android: package `com.arenafit.app`, SHA-256 signing fingerprints (EAS: `eas credentials`
   → keystore SHA-256; Play App Signing key too). Branch hosts `assetlinks.json`.
4. Default fallback URLs: the App Store / Play Store pages (once published), or a web page
   that explains « Téléchargez Arena Fit puis saisissez votre code ».

## How links are built and read

* Share URL: `https://<branch domain>/?af_invite=<share token>` — a Branch *long link*: its
  query parameters become link data, so no link-creation API call is needed and nothing is
  generated on the client except the URL around the server-issued token.
* App open (installed): the OS opens the app with the URL → `+native-intent.tsx` validates it
  and routes `/invite/<token>`. The Branch SDK also reports it; the listener ignores duplicates.
* First open after install (deferred): `branch.subscribe()` returns
  `{ '+clicked_branch_link': true, af_invite: '<token>' }` → validated by
  `parseBranchParams()` → `/invite/<token>`.
* Accepted payloads: only `af_invite` matching the 43-char token format from a clicked Branch
  link. `$deeplink_path`, `$canonical_url`, `+url` and any other field are ignored — no URL
  from Branch is ever opened or routed. Unknown/invalid links land on Accueil or the
  « Invitation introuvable » screen.
* Fallback: every invitation has a short code (`AF-XXXX-XXXX`) shown to the member. The
  friend uses Profil/Accueil › « J'ai un code d'invitation ». The code resolves the **same**
  invitation — it can't create a second pass.

## What has been tested — and what has not

Tested here (web preview + local Supabase + unit tests):

* link/URL/payload validation, the Branch adapter with a simulated SDK (normal open, deferred
  first open, errors, malformed payloads),
* the full flow on web: create → share preview → open link → preview → activate → Guest Mode, the
  short-code fallback, re-opening a link, cancelled / expired / invalid / already-claimed states,
* server rules (pgTAP + HTTP integration tests incl. concurrency).

**Not tested — needs a Branch account, real builds and real devices:**

* that the Branch native SDK initialises with this config plugin on Expo SDK 58,
* universal links / app links opening the installed app (AASA / assetlinks verification),
* deferred deep linking through a real store install (TestFlight / Play internal testing),
* WhatsApp / iMessage / Instagram in-app browsers (they sometimes block universal links;
  the Branch interstitial and the short code cover that),
* attribution after a long delay between tap and first open.

Do **not** consider deferred deep linking working until this checklist passes on at least
one iPhone and one Android phone:

1. App not installed → tap link in WhatsApp → store → install → open → invitation preview
   appears without typing anything.
2. App installed → tap link → app opens directly on the preview.
3. Same with the alternate domain.
4. Link opened in a browser that blocks app links → Branch fallback page → code works.
5. Activate → Guest Mode; reopen the link → straight back to « Utiliser mon Pass ».

## Note on builds without Branch

`react-native-branch` is installed, so its native module is autolinked in every native build,
but the JS module is only loaded when `EXPO_PUBLIC_BRANCH_KEY` and `EXPO_PUBLIC_BRANCH_DOMAIN`
are set. Verify in the first dev build without Branch that app start is unaffected.
