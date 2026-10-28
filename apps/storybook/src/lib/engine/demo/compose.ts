import { READING_LEVEL_CATALOG } from '@/config/catalog';
import { typesetFrench } from '@/lib/typeset';

import {
  ADVENTURES,
  type AdventureId,
  type SceneMoment,
  type StoryConfiguration,
  type StoryPage,
  type Storybook,
  type StoryPageKind,
} from '../types';
import type { Line, StoryTemplates, TemplateContext } from './template-types';
import { ar } from './templates/ar';
import { en } from './templates/en';
import { fr } from './templates/fr';

export const TEMPLATES: Record<StoryConfiguration['storyLanguage'], StoryTemplates> = { fr, en, ar };

/** Pages a finished book is planned to have; the demo only writes a sample of them. */
export const PLANNED_STORY_PAGES = 24;

/** Small stable string hash (FNV-1a) — deterministic ids and "surprise" picks. */
export function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** "Surprise me" resolves to the same mission for the same child and world, so previews stay stable. */
export function resolveAdventure(config: StoryConfiguration): AdventureId {
  if (config.adventure.kind === 'mission') return config.adventure.id;
  const seed = hash(`${config.child.firstName.trim().toLowerCase()}|${config.world}|${config.objective}`);
  return ADVENTURES[seed % ADVENTURES.length];
}

export function templateContext(config: StoryConfiguration): TemplateContext {
  const t = TEMPLATES[config.storyLanguage];
  const w = t.worlds[config.world];
  const form = config.child.form;
  const companion = config.companions[0];
  return {
    name: config.child.firstName.trim(),
    age: config.child.age,
    g: (m, f) => (form === 'f' ? f : m),
    e: form === 'f' ? 'e' : '',
    w,
    cg: (m, f) => (w.creatureForm === 'f' ? f : m),
    comp: companion ? { name: companion.name.trim(), g: (m, f) => (companion.form === 'f' ? f : m) } : undefined,
  };
}

function render(lines: Line[], depth: number, fix: (s: string) => string): string {
  return fix(
    lines
      .filter((l) => typeof l === 'string' || l.depth <= depth)
      .map((l) => (typeof l === 'string' ? l : l.text))
      .join(' '),
  );
}

/**
 * Builds the sample book shown in the Studio from hand-written templates.
 * Deterministic and offline: the same configuration always gives the same pages.
 */
export function composeSampleStorybook(config: StoryConfiguration): Storybook {
  const t = TEMPLATES[config.storyLanguage];
  const c = templateContext(config);
  const depth = READING_LEVEL_CATALOG[config.readingLevel].depth;
  const fix = config.storyLanguage === 'fr' ? typesetFrench : (s: string) => s;
  const adventureId = resolveAdventure(config);
  const adventure = t.adventures[adventureId];
  const objective = t.objectives[config.objective];
  const companion = config.companions[0];
  const role = companion ? t.roles[companion.role] : undefined;
  const cast = ['child', ...config.companions.map((p) => p.id)];

  let number = 0;
  const page = (kind: StoryPageKind, moment: SceneMoment, sections: Line[][], extra: Partial<StoryPage> = {}): StoryPage => {
    number += 1;
    return {
      id: `${kind}-${moment}`,
      kind,
      number,
      heading: kind === 'dedication' ? t.headings.dedication : t.headings[moment],
      paragraphs: sections.map((s) => render(s, depth, fix)).filter(Boolean),
      scene: { world: config.world, moment, characters: moment === 'arrival' ? cast : [...cast, 'creature'] },
      ...extra,
    };
  };

  const pages: StoryPage[] = [
    page('dedication', 'arrival', [[config.dedication?.trim() || t.defaultDedication(c)]]),
    page('story', 'arrival', [t.opening(c), c.w.arrival(c)]),
    page('story', 'meeting', [role ? role.meet(c) : t.soloMeet(c), adventure.hook(c)]),
    page('learning', 'learning', [objective.learning(c)], { prompt: fix(objective.question(c)), keywords: objective.keywords }),
    page('story', 'challenge', [adventure.challenge(c), objective.solve(c), role ? role.help(c) : []]),
    page('ending', 'triumph', [adventure.triumph(c), t.ending(c)]),
  ];

  return {
    id: `demo-${hash(JSON.stringify({ ...config, child: { ...config.child, photo: undefined }, companions: config.companions.map((p) => ({ ...p, photo: undefined })) })).toString(36)}`,
    source: 'demo-template',
    isSample: true,
    language: config.storyLanguage,
    direction: config.storyLanguage === 'ar' ? 'rtl' : 'ltr',
    title: fix(adventure.title(c)),
    tagline: fix(t.tagline(c)),
    summary: fix(t.summary(c, adventure, objective)),
    learningGoals: [objective.goal],
    adventure: adventureId,
    pages,
    plannedPageCount: PLANNED_STORY_PAGES,
    config,
  };
}
