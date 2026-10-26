# Admin dashboard — roles & staff accounts

Internal tool for the Arena Fit team (`apps/admin`, Next.js). Staff sign in with
Supabase Auth (email + password). What each person can do is decided by the
**database**, from their row in `public.admin_users`; the dashboard only hides
what the database would refuse anyway.

## Roles

| Section | Administrateur (`admin`) | Responsable contenu (`content_manager`) | Accueil (`reception`) |
|---|:-:|:-:|:-:|
| Tableau de bord | ✓ | ✓ (classes, news) | ✓ (classes, Guest Pass) |
| Planning, Activités, Coachs, Actualités | ✓ | ✓ | — |
| Notifications (drafts only) | ✓ | ✓ | — |
| Pass Invité — list & detail | ✓ | — | ✓ |
| Pass Invité — cancel an invitation | ✓ | — | — |
| Stations réception — list & detail | ✓ | — | ✓ |
| Stations — create, rotate, deactivate, reactivate | ✓ | — | — |
| Membres (limited view) | ✓ | — | — |
| Journal des actions | ✓ | — | — |

Anyone signed in without an `admin_users` row (members, guests) gets « Accès refusé »
and every admin RPC / table answers `42501 forbidden`.

## Adding, changing or removing staff

Nobody can grant a role from the apps — not even an admin from the dashboard
(`admin_users` has no write policy for any signed-in user; self-promotion is
silently filtered). Staff accounts are managed by the club owner in the Supabase
project:

1. **Authentication → Users → Invite user** (or *Add user*) with the person's email.
2. **SQL editor** (service role):

   ```sql
   insert into public.admin_users (user_id, role, display_name)
   select id, 'content_manager', 'Prénom N.' from auth.users where email = 'prenom@arenafit.ma';
   -- change role:  update public.admin_users set role = 'reception' where user_id = '…';
   -- revoke:       delete from public.admin_users where user_id = '…';
   ```

Revoking takes effect on the next request (each request re-reads the role).

## What is audited

`public.admin_audit_log` (readable by admins only, written only by database triggers
and RPCs, never by the browser): sessions created / modified (with the changed
fields) / cancelled / restored / deleted / duplicated, news created / modified /
published / unpublished / deleted, coaches and activities created / modified /
deactivated / reactivated, a coach's activities, stations created / renamed /
rotated / deactivated / reactivated, invitations cancelled. Each entry: who, role,
action, entity, time and a short label (name, title, date). No tokens, hashes,
QR payloads, emails of guests or passwords are ever written.

## Things the dashboard deliberately does not do

* **Send push notifications.** Drafts only — sending needs device registration, the
  final member login and Expo/FCM/APNs credentials (labelled « Envoi pas encore actif »).
* **Show secrets.** Station QR payloads are shown once, in the print step, and never
  again; invitation links/codes are never shown (only their hashes exist).
* Payments, bookings, waitlists, loyalty, CRM, analytics, segmentation.

## Images

JPEG / PNG / WebP up to 5 MB (checked from the file's bytes, not its name, then again
by the storage bucket). Public buckets `coaches`, `activities`, `classes`, `news`;
only content managers and admins can write. Without an image the app shows its
default artwork.
