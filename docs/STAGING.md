# Staging & stakeholder demo

Everything needed to show the Arena Fit MVP to stakeholders:

| Piece | Where | Set up once | Before each meeting |
|---|---|---|---|
| Database, Auth, Storage | Supabase project **arenafit-staging** | §1 | `npm run staging -- reset` (§6) |
| Admin dashboard | Vercel (`apps/admin`) | §2 | — |
| Demo data & accounts | created by `scripts/staging/staging.mjs` | §3 | same reset |
| Reception QR | printed from the staging dashboard | §4 | keep the print |
| Android app | EAS preview APK (`apps/mobile`) | §5 | — |

Staging is **not production**: a separate Supabase project, its own accounts, presentation
data only. No automated test, local fixture or test account ever goes there (the integration
tests refuse any non-local URL; the dataset is `supabase/staging/presentation.sql`).

**Requirements on your computer:** Git, Node 22 + npm (macOS, Linux, or Windows with Git Bash /
WSL). The Supabase, EAS and Vercel CLIs are run with `npx` — nothing else to install.
**Accounts:** Supabase, Vercel, Expo (free tiers are enough). An Android phone (two for the
smoothest Guest Pass demo) and a printer.

---

## 1. Supabase staging project

### 1.1 Create the project (dashboard)

1. supabase.com → **New project** → name `arenafit-staging`, a strong database password
   (keep it), region close to Morocco (e.g. *West EU (Paris)* or *West EU (Ireland)*).
2. **Authentication → Sign In / Providers → Allow anonymous sign-ins: ON**
   (the Guest Pass creates an anonymous guest identity on activation). Leave email sign-in on.
3. **Authentication → URL Configuration → Site URL:** your dashboard URL once you have it (§2).

### 1.2 Collect the values

From the project dashboard:

| Value | Where |
|---|---|
| Project ref (20 lowercase characters) | Project Settings → General → *Project ID* |
| Project URL `https://<ref>.supabase.co` | Project Settings → Data API |
| **anon** key (public) | Project Settings → API Keys → *Legacy API keys* → `anon` `public` (or the *Publishable* key) |
| **service_role** key (secret) | same page → `service_role` (or a *Secret* key `sb_secret_…`) |
| Database URL | **Connect** (top bar) → *Session pooler* → URI; put your DB password in it, percent-encoded if it has special characters |

The service-role key and the database URL stay on your computer, in `.env.staging`
(git-ignored). They never go to Vercel, EAS, the apps or a commit.

### 1.3 Commands (from the repository root)

```bash
npm install
npm run staging -- init            # creates .env.staging (git-ignored, mode 600) with generated demo passwords
# → edit .env.staging: fill the STAGING_* values from §1.2 (and PRODUCTION_PROJECT_REF if one exists)

set -a; source .env.staging; set +a

# all migrations (recorded in Supabase's migration history) + the production seed
npx supabase@2.122.0 db push --db-url "$STAGING_DB_URL" --include-seed

# one-time: mark this database as the staging project (the reset refuses any unmarked database)
npm run staging -- mark-staging --confirm "$STAGING_PROJECT_REF"

npm run staging -- check           # configuration, guards, migrations, anonymous sign-ins
```

`db push` applies `supabase/migrations/*` (6 files) and `supabase/seed.sql` (the real coach
roster, classes and pairings, club timezone, Guest Pass allowance). It asks for confirmation
before seeding; answer `Y`. Later migrations: run the same `db push` (only new files apply).

---

## 2. Admin dashboard on Vercel

1. vercel.com → **Add New → Project** → import the GitHub repository.
2. **Root Directory: `apps/admin`** (Framework: Next.js is detected). `apps/admin/vercel.json`
   sets the install (`npm ci` of the dashboard workspace only — the mobile app's packages are not
   installed) and the build; keep Vercel's defaults otherwise.
3. **Environment Variables** (Production, and Preview if you use preview deployments):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **anon** / publishable key |

   Nothing else. **Never** the service-role key: the build fails on purpose if a server key
   (service_role JWT or `sb_secret_…`) is found in any `NEXT_PUBLIC_*` variable, or if the URL
   is not `https://<ref>.supabase.co` (`apps/admin/next.config.ts`).
4. **Production Branch** (Settings → Git): the branch you deploy (e.g. `main` after merging, or
   this feature branch for the demo).
5. **Deploy** → you get:

   ```
   Arena Fit Admin:
   https://<your-project>.vercel.app
   ```

6. Put that URL in Supabase → Authentication → URL Configuration → *Site URL*.

The dashboard is `noindex` and only usable with a staff account (roles enforced by the database).

---

## 3. Demo data and accounts

```bash
npm run staging -- reset
```

Creates (or restores) the presentation dataset — see §6 for exactly what it does. Accounts
(emails and passwords are in your `.env.staging`; change the emails there before the first
reset if you prefer your own addresses — they don't need to receive mail):

| Account | `.env.staging` keys | Shown as | Used for |
|---|---|---|---|
| Administrateur | `DEMO_ADMIN_*` | Direction | dashboard: everything, stations, journal |
| Responsable contenu | `DEMO_CONTENT_*` | Équipe contenu | dashboard: planning, activities, coaches, news |
| Accueil | `DEMO_RECEPTION_*` | Accueil | dashboard: Guest Passes, station list |
| Membre démo | `DEMO_MEMBER_*` | Sara Benali | Android app: « Offrir un Pass » |
| Membre (exemples) | `DEMO_INVITER_*` | Karim Alaoui | owns the Guest Pass examples; not used live |
| Invités | — | Yassine (used) · Imane (active guest) · Mehdi (sent) | examples in the dashboard |

Guests are anonymous identities created by the real activation flow — no password.
Give the dashboard passwords to whoever presents; don't paste them in shared docs or chats.

---

## 4. Reception station and the printed QR

The QR must come from **staging** (a local development QR never works there).

1. Sign in to the staging dashboard as **Administrateur** → **Stations réception**.
2. **Nouvelle station** → `Réception principale` → **Créer la station**.
3. The print window opens once: **Imprimer** the A5 poster (and/or the A6 counter card) at
   100 % scale on white paper. The QR is never shown again (only its hash is stored). Lost or
   doubtful print → open the station → **Renouveler et imprimer le QR** (the old print stops
   working immediately).
4. Run `npm run staging -- reset` again: the « used » example is now recorded at this station.

The reset never touches stations: the printed QR stays valid across resets.

---

## 5. Android preview APK (EAS)

Run in `apps/mobile`:

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init        # creates the EAS project; if it asks you to add the project ID to the
                               # app config manually, add to app.json → "expo": { "owner": "<account>",
                               # "extra": { "eas": { "projectId": "<id>" } } } and commit it (not a secret)

# Staging values for the « preview » environment (EAS stores them; nothing local)
source ../../.env.staging
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value "$STAGING_SUPABASE_URL" --visibility plaintext
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "$STAGING_ANON_KEY" --visibility sensitive
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_STAGING_MEMBER_EMAIL --value "$DEMO_MEMBER_EMAIL" --visibility plaintext
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_STAGING_MEMBER_PASSWORD --value "$DEMO_MEMBER_PASSWORD" --visibility sensitive

npx eas-cli@latest build --profile preview --platform android
```

* The `preview` profile (`eas.json`) builds an installable **APK** (internal distribution), uses the
  EAS `preview` environment, sets `APP_VARIANT=preview` (package `com.arenafit.app.preview`, so it
  installs beside a future store app) and `EXPO_PUBLIC_STAGING_DEMO_SIGNIN=1`.
* The first build asks to generate an Android keystore: answer **Yes** (EAS keeps it).
* **The build fails early on purpose** if the URL is not `https://<ref>.supabase.co` (localhost,
  LAN address, empty), if a value is missing, if any `EXPO_PUBLIC_DEV_*` variable is set, or if a
  server key is in a public variable (`apps/mobile/app.config.ts`).
* When it finishes: open the build page link (or scan its QR) on the phone → download → install
  (allow *Install unknown apps* for the browser when Android asks).
* Never set `EXPO_PUBLIC_STAGING_DEMO_SIGNIN` for the `production` environment — that build would
  fail on purpose; release bundles are checked for it (`npm run check:release`).

### Staging demo sign-in (preview builds only)

Member sign-in isn't built yet. In this APK, **Profil → Accès démo → Membre démo** signs in the
demo member with real Supabase auth (the account from `.env.staging`); **Visiteur** signs out.
No fixture data, no simulator. Its password is inside the APK — acceptable for a staging-only
account (reset it with `npm run staging -- reset` after changing `DEMO_MEMBER_PASSWORD`, then
update the EAS variable and rebuild).

---

## 6. Presentation reset (before every meeting)

```bash
set -a; source .env.staging; set +a   # only needed for the CLI commands above; reset reads the file itself
npm run staging -- reset
```

Takes ~15 s and is safe to repeat. **Refuses** unless: the URL is `https://<STAGING_PROJECT_REF>.supabase.co`,
the database URL points at the same project, the ref differs from `PRODUCTION_PROJECT_REF`, and
the database carries the staging marker (checked again inside the SQL). Production can't be
touched by mistake.

It restores:

* coach roster, class names/categories and coach ↔ class pairings exactly as in the production
  seed (undoes edits made during a demo; activities or coaches added during a demo are hidden),
* presentation content: 4 rooms, 2 weeks of planning starting this week (real pairings only),
  descriptions for well-known formats, 4 published news items,
* demo accounts, roles, names, active memberships, passwords from `.env.staging`,
* Guest Passes: removes all invitations, passes, guest identities and check-ins, then recreates
  the three examples — Mehdi *sent* (1 h ago), Imane *activated* (the active guest),
  Yassine *used* yesterday 18:12 at the active station — through the real functions,
* the demo member's 3 passes, empty favourites, reminders and notification drafts, empty journal.

It keeps: reception stations (and their printed QR), anything in Storage (image fields are
cleared, files stay), the demo phones' installed app.

On the phones after a reset: **guest phone → Profil → Quitter le mode invité** (or Android
Settings → Apps → Arena Fit → Storage → Clear storage) so it starts as a visitor again; the member
phone can stay signed in.

---

## 7. Meeting checklist

Prepare: `npm run staging -- reset` · printed QR at hand · member phone signed in (Profil → Accès
démo → Membre démo) · guest phone (or the same phone, see note) on the home screen as visitor ·
dashboard open and signed in.

- [ ] **Admin login** — dashboard URL → Administrateur → Tableau de bord (classes today/week, news, Guest Pass figures).
- [ ] **Edit planning** — Planning → open a class later this week → move 18:00 → 19:00 (or change the coach) → Enregistrer.
- [ ] **Mobile planning updates** — member phone → Planning → pull to refresh → the class shows the new time.
- [ ] **Member Guest Pass** — member phone → Profil → Pass & Invitations → Offrir un Pass → prénom → Créer l'invitation → show the **Code de secours** (AF-XXXX-XXXX).
- [ ] **Guest activation** — guest phone → Accueil → « J'ai un code d'invitation » → code → Continuer → « Sara vous invite… » → **Activer mon Pass** → Mode Invité.
- [ ] **Scan reception QR** — guest phone → « Utiliser mon Pass » → **Scanner le QR** → allow the camera → scan the printed QR.
- [ ] **PASS VALIDÉ** — live confirmation with time and station; dashboard → Pass Invité shows it as *Utilisé*.
- [ ] **News** — dashboard → Actualités → Nouvel article → Publier maintenant → member phone → Actualités → refresh.
- [ ] **Coaches / Activities** — dashboard → Coachs (roster, assigned classes) and Activités (description, intensity, active/inactive) → the app reflects edits.
- [ ] Optional: Accueil account (restricted menu), Journal des actions, a station's QR print window.

One phone only? Do the member part, then Profil → Accès démo → **Visiteur**, then the guest part on
the same phone.

---

## 8. Still simulated or not production-ready

* **Member sign-in** — not built. The APK's « Accès démo » signs in one staging account whose
  password is embedded in the APK. Production builds can't include it.
* **Invitation links** — Branch is not configured, so the shared link (`arenafit://…`) is not
  tappable in WhatsApp; the guest types the **Code de secours** instead. Deferred deep linking
  needs Branch (docs/BRANCH.md).
* **Push notifications** — not sent. Class reminders are local notifications on the phone; the
  dashboard's Notifications page is drafts only (labelled « Envoi pas encore actif »).
* **Presentation data** — rooms, class times, levels, some class descriptions and the news are
  invented for the demo; coach roster, class names and coach ↔ class pairings are real.
  Club-specific formats (Arena's Synergy, Arena 500, …) have no description until the club writes one.
* **Images** — no club photography yet: the apps show their designed placeholder artwork.
* **Guest conversion tracking**, payments, bookings — not part of the MVP.
* **Static reception QR** — a photo of the printed QR works elsewhere; it still needs an active
  one-use Guest Pass. Rotate it from the dashboard if in doubt.
* **Not verified on a real device by the developer** — the APK is built by you; the flows were
  rehearsed in a production-mode web build and the database checks, not on Android hardware.
* Staging uses Supabase's default auth email sender (not needed for the demo: accounts are created
  confirmed).
