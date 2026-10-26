# Presentation photos (temporary)

A small, curated set of royalty-free fitness photos used **only to present the
MVP** while real Arena Fit photography doesn't exist yet. They are not club
photos and must not ship as production content.

## How it works

The photos are **content, not code**: the apps contain no stock imagery. The loader
uploads them to Supabase Storage under `presentation/` and points
`activities.image_path` / `news.cover_path` at them — **only** where a row has no
image yet. Everything that shows an image (home hero, activity cards and pages,
class pages, news) then displays them through the normal data path.

* **Replacing with a real photo:** upload it in the dashboard (Activités / Actualités →
  Image → Remplacer). The dashboard tags temporary photos « Photo de démo » / « Démo »
  so staff can see what is left to replace. The loader never overwrites a real photo.
* **Removing them all:** `npm run presentation:remove -- --local` (or against a project,
  see below); the apps fall back to their default category artwork.
* **Coaches** keep the initials avatar until real portraits exist (no stock faces
  presented as Arena Fit coaches).
* The production seed stays photo-free (`supabase/tests/seed_facts.test.sql` checks it).

## The set

Eight slots, one shared look (prepared at 1600×1000, 16:10, same grade):

| Slot | Used for |
|---|---|
| `strength` | fitness classes by default (Body Pump, Arena 500, Synergy, Full Legs…), offers |
| `hiit` | Body Attack, Cardio Mix, Circuit, Challenge, Grit; challenge news |
| `core` | Core, Sprint Core, Core / Mobility |
| `cycling` | RPM, Sprint, RPM Mixte, Biking Adventure |
| `mobility` | Mobility, Stretching |
| `combat` | Body Combat |
| `club` | schedule, event, equipment and general news |
| `recovery` | wellness news |

Assignments are in `manifest.json` (`bySlug` overrides, then `byCategory`), so a new
activity or article is covered automatically by its category.

## Adding or changing a photo

1. Choose a photo on a royalty-free source (e.g. Unsplash: Unsplash License — free
   commercial use, no attribution required). Dark or neutral light, one subject,
   no visible brand logos, no watermark, no text.
2. Save it as `presentation/source/<slot>.jpg` (git-ignored).
3. Record its origin in `manifest.json` → `images.<slot>.credit`
   (`author`, `url`, `license`). The loader refuses a photo without it. Credits stay in
   this repository — never in the apps' UI.
4. Optional: `"focus": [x, y]` (0–1) to steer the 16:10 crop.
5. `npm run presentation:prepare` → `presentation/images/<slot>.jpg` (cropped, graded,
   metadata stripped).

## Applying

```bash
npm run presentation:apply -- --local            # local stack (scripts/local-stack/up.sh)
SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=… \
  npm run presentation:apply                     # a presentation / staging project
node scripts/presentation/images.mjs status --local
```

`--dry-run` shows what would change. Runs are idempotent. The service-role key is used
from the operator's machine only.
