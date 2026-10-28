import type { AdventureId, CharacterRoleId, LearningObjectiveId, SceneMoment, WorldId } from '../types';

/**
 * A sentence in a demo template. Plain strings are read at every level;
 * `{ text, depth }` lines only appear from that reading depth upwards, so the
 * chosen reading level genuinely changes how much is written on each page.
 */
export type Line = string | { text: string; depth: 2 | 3 };
export const d2 = (text: string): Line => ({ text, depth: 2 });
export const d3 = (text: string): Line => ({ text, depth: 3 });

type Gender = <T>(m: T, f: T) => T;

export interface WorldText {
  /** "la Forêt enchantée" */
  name: string;
  /** "de la Forêt enchantée" — for titles and genitives. */
  of: string;
  /** "dans la Forêt enchantée" */
  in: string;
  arrival: (c: TemplateContext) => Line[];
  /** Full introduction of the world's creature: "Noisette, un petit renard aux yeux d'or". */
  creature: string;
  creatureName: string;
  creatureForm: 'm' | 'f';
  colorsLine: string;
  countLine: string;
  animalsLine: string;
  natureLine: string;
}

export interface AdventureText {
  title: (c: TemplateContext) => string;
  /** Completes "…sets off to ___" in the summary. */
  goal: (c: TemplateContext) => string;
  hook: (c: TemplateContext) => Line[];
  challenge: (c: TemplateContext) => Line[];
  triumph: (c: TemplateContext) => Line[];
}

export interface ObjectiveText {
  /** Shown in the learning objectives list. */
  goal: string;
  /** Completes "…learns to ___" in the summary. */
  learns: string;
  learning: (c: TemplateContext) => Line[];
  solve: (c: TemplateContext) => Line[];
  question: (c: TemplateContext) => string;
  keywords: string[];
}

export interface RoleText {
  meet: (c: TemplateContext) => Line[];
  help: (c: TemplateContext) => Line[];
}

export interface StoryTemplates {
  tagline: (c: TemplateContext) => string;
  summary: (c: TemplateContext, adventure: AdventureText, objective: ObjectiveText) => string;
  defaultDedication: (c: TemplateContext) => string;
  headings: Record<SceneMoment, string> & { dedication: string };
  opening: (c: TemplateContext) => Line[];
  soloMeet: (c: TemplateContext) => Line[];
  ending: (c: TemplateContext) => Line[];
  worlds: Record<WorldId, WorldText>;
  adventures: Record<AdventureId, AdventureText>;
  objectives: Record<LearningObjectiveId, ObjectiveText>;
  roles: Record<CharacterRoleId, RoleText>;
}

export interface TemplateContext {
  name: string;
  age: number;
  /** Child agreement: g('il', 'elle'). */
  g: Gender;
  /** French feminine "e" for the child: prêt${e}. */
  e: string;
  w: WorldText;
  /** World creature agreement (needed for Arabic verbs). */
  cg: Gender;
  comp?: { name: string; g: Gender };
}
