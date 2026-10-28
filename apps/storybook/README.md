# Hikaya — personalised educational storybooks

A web app where parents and children create a personalised illustrated book:
the child is the hero, a loved one can join the adventure, and every story
carries a learning objective. French by default, with English and Arabic
interfaces (full right-to-left), MAD pricing for Morocco.

> **Demo mode.** Everything runs offline, with no API keys. Books are composed
> from hand-written templates and provisional SVG illustrations and are always
> labelled as *samples*. Orders are never transmitted and no payment is taken.
> Photos never leave the device.

```bash
npm install                     # from the repo root
npm run hikaya                  # http://localhost:3200
npm run test -w apps/storybook  # engine + validation tests
npm run build -w apps/storybook
```

## Routes

| Route      | What it is |
| ---------- | ---------- |
| `/`        | Editorial homepage: hero (open book with a world rising from it), product story, how it works, learning, family, six-world showcase, production process, final CTA |
| `/create`  | Story Studio: seven full-screen pages (hero → language & level → objective → world → companion → adventure → reveal). Progress is saved in `localStorage`. `?world=<id>` preselects a world |
| `/preview` | Reading room: cover, sample spreads with page-turn transitions, swipe and arrow keys, then an honest "end of sample" page |
| `/order`   | Format → delivery → summary → demo confirmation. Nothing is sent |

## Structure

```
src/
  app/                 routes, root layout (locale cookie → <html lang dir>), global design tokens
  art/                 provisional SVG art: WorldScene (6 worlds × 5 story moments), silhouettes, creatures
  components/
    home/              homepage sections and the hero book
    studio/            Studio shell, StepFrame, accessible fields, one file per step
    book/              BookCover (CSS 3D hardcover), BookSpread, BookViewer
    order/             OrderFlow
    ui/                header, footer, logo, language switcher, reveal, button styles
  config/              brand name, catalog palettes & reading levels, products & PLACEHOLDER prices
  i18n/                fr (source of the Messages type), en, ar; server cookie reader; client provider
  lib/
    engine/            domain types, provider interfaces, demo template engine
    orders/            OrderGateway boundary + demo gateway
    validation.ts      Zod schemas (messages are i18n keys)
    photo.ts           in-browser downscale + re-encode (strips EXIF/GPS)
  store/               Zustand stores: story draft (localStorage), order draft (sessionStorage)
```

## Story engine

`lib/engine/types.ts` defines the domain model — `ChildProfile`, `StoryCharacter`,
`LearningObjective`, `ReadingLevel`, `StoryWorld`, `StoryAdventure`,
`StoryConfiguration`, `StoryPage`, `Storybook`, `BookFormat`, `OrderDraft`.

`lib/engine/providers.ts` declares the six roles as interfaces only:
**Story Architect**, **Educational Designer**, **Creative Writer**, **Story Editor**,
**Illustration Director** and **Publishing Engine**, plus `createStoryPipeline()`
which chains them. Nothing there calls a model.

Today the app uses `lib/engine/demo/`:

- `compose.ts` builds a six-page sample (dedication + five story moments) from
  `templates/{fr,en,ar}.ts`. Choices genuinely change the text: the world sets
  the place and creature, the mission sets the plot, the objective writes the
  learning page *and* how the challenge is solved, the companion's role gives
  them lines on three pages, and the reading level filters sentence depth.
  French and Arabic agree with the hero's and companion's grammatical gender.
  "Surprise me" resolves deterministically.
- `editor-checks.ts` is the mechanical part of the Story Editor (no unfilled
  slots, name present, sentence length per level). The test suite runs it over
  all 19,440 combinations.
- `illustration-briefs.ts` turns pages into image-generation briefs. Child
  photos are deliberately never included.

**Connecting real AI**: implement the interfaces in `providers.ts` server-side
(an API route or server action — never ship provider keys to the browser), add
an `api` mode next to `STORY_ENGINE_MODE` in `lib/engine/index.ts`, and keep
`source: 'ai'` / `isSample` accurate so the UI stays honest. Sending child
photos to any image service needs explicit consent and a vetted provider.

## Commerce

Prices in `src/config/products.ts` are **placeholders** (`pricePlaceholder: true`
shows a "provisional price" notice). Shipping is never quoted in the demo.
`lib/orders/gateway.ts` is the seam for a real backend: persist the order
(e.g. Supabase), create a payment session with a provider, return its redirect.
The browser never handles card data.

## Art

Scenes in `src/art/` are clearly provisional compositions so the product can be
evaluated end to end. To ship original artwork, render an image per
world/moment inside `WorldScene` and keep the 4:3 frame. The silhouettes avoid
skin tone and facial features on purpose.

## Accessibility & performance

- Native radios behind every choice tile (arrow keys, screen readers), visible
  focus rings, focus moved to each Studio question, `aria-live` on counters.
- `prefers-reduced-motion`: page turns become fades, ambient animations stop,
  scroll reveals never hide content.
- 3D is CSS transforms only; no WebGL. Fonts are self-hosted (Fontsource) with
  unicode ranges, so Arabic font files load only when Arabic text appears.
