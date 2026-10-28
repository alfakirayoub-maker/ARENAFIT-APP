'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type {
  CharacterRoleId,
  GrammaticalForm,
  LearningObjectiveId,
  LocalPhoto,
  Locale,
  ReadingLevelId,
  RelationshipId,
  StoryAdventure,
  StoryConfiguration,
  WorldId,
} from '@/lib/engine/types';
import { configurationSchema } from '@/lib/validation';

import { localJSON } from './storage';

/** The six choices offered on the companion screen; grandparents/sibling are refined into a relationship. */
export type CompanionChoice = 'none' | 'mother' | 'father' | 'grandparents' | 'sibling' | 'other';

export interface CompanionDraft {
  name: string;
  relationship?: RelationshipId;
  relationshipLabel: string;
  form?: GrammaticalForm;
  role?: CharacterRoleId;
  photo?: LocalPhoto;
  photoConsent: boolean;
}

export interface StoryDraft {
  child: { firstName: string; age?: number; form?: GrammaticalForm; photo?: LocalPhoto; photoConsent: boolean };
  storyLanguage?: Locale;
  readingLevel?: ReadingLevelId;
  objective?: LearningObjectiveId;
  world?: WorldId;
  companionChoice?: CompanionChoice;
  companion: CompanionDraft;
  adventure?: StoryAdventure;
  customIdea: string;
  dedication: string;
}

export const STUDIO_STEPS = ['hero', 'language', 'objective', 'world', 'companion', 'adventure', 'reveal'] as const;
export type StudioStep = (typeof STUDIO_STEPS)[number];

const emptyDraft = (): StoryDraft => ({
  child: { firstName: '', photoConsent: false },
  companion: { name: '', relationshipLabel: '', photoConsent: false },
  customIdea: '',
  dedication: '',
});

interface StoryState {
  draft: StoryDraft;
  step: number;
  /** Follow-up page inside a step (companion details, adventure details). */
  sub: number;
  /** Furthest step reached, so the progress bar can jump back without skipping ahead. */
  reached: number;
  update: (patch: Partial<StoryDraft>) => void;
  updateChild: (patch: Partial<StoryDraft['child']>) => void;
  updateCompanion: (patch: Partial<CompanionDraft>) => void;
  goTo: (step: number, sub?: number) => void;
  reset: () => void;
}

export const useStoryStore = create<StoryState>()(
  persist(
    (set) => ({
      draft: emptyDraft(),
      step: 0,
      sub: 0,
      reached: 0,
      update: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      updateChild: (patch) => set((s) => ({ draft: { ...s.draft, child: { ...s.draft.child, ...patch } } })),
      updateCompanion: (patch) => set((s) => ({ draft: { ...s.draft, companion: { ...s.draft.companion, ...patch } } })),
      goTo: (step, sub = 0) => set((s) => ({ step, sub, reached: Math.max(s.reached, step) })),
      reset: () => set({ draft: emptyDraft(), step: 0, sub: 0, reached: 0 }),
    }),
    {
      name: 'hikaya-story',
      version: 1,
      storage: localJSON,
      // Rehydrated manually after mount so server and first client render match.
      skipHydration: true,
    },
  ),
);

/** Builds a validated configuration from the draft, or null while steps are missing. */
export function toConfiguration(draft: StoryDraft): StoryConfiguration | null {
  const c = draft.companion;
  const withCompanion = draft.companionChoice && draft.companionChoice !== 'none';
  const candidate = {
    version: 1 as const,
    child: {
      firstName: draft.child.firstName,
      age: draft.child.age,
      form: draft.child.form,
      // A photo is only used once a parent or guardian has consented.
      photo: draft.child.photoConsent ? draft.child.photo : undefined,
    },
    storyLanguage: draft.storyLanguage,
    readingLevel: draft.readingLevel,
    objective: draft.objective,
    world: draft.world,
    companions: withCompanion
      ? [
          {
            id: 'companion-1',
            name: c.name,
            relationship: c.relationship,
            relationshipLabel: c.relationshipLabel || undefined,
            form: c.form,
            role: c.role,
            photo: c.photoConsent ? c.photo : undefined,
          },
        ]
      : [],
    adventure: draft.adventure,
    customIdea: draft.customIdea.trim() || undefined,
    dedication: draft.dedication.trim() || undefined,
  };
  const parsed = configurationSchema.safeParse(candidate);
  return parsed.success ? (parsed.data as StoryConfiguration) : null;
}
