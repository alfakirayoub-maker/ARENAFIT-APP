/**
 * Domain model for personalised storybooks.
 *
 * These types are the contract between the Story Studio (UI), the story engine
 * (demo templates today, AI providers later — see providers.ts), ordering and a
 * future Supabase schema. Keep them serialisable: no functions, no class instances.
 */

export const LOCALES = ['fr', 'en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
/** Stories are written in one of the interface languages. */
export type StoryLanguage = Locale;

export const READING_LEVELS = ['first-steps', 'young-reader', 'confident-reader'] as const;
export type ReadingLevelId = (typeof READING_LEVELS)[number];

export const LEARNING_OBJECTIVES = [
  'colors',
  'numbers',
  'animals',
  'vocabulary',
  'friendship',
  'emotions',
  'nature',
  'confidence',
  'problem-solving',
] as const;
export type LearningObjectiveId = (typeof LEARNING_OBJECTIVES)[number];

export const WORLDS = ['enchanted-forest', 'space', 'ocean', 'dinosaur-valley', 'secret-garden', 'magic-castle'] as const;
export type WorldId = (typeof WORLDS)[number];

export const ADVENTURES = [
  'lost-treasure',
  'magical-creature',
  'ancient-mystery',
  'unknown-world',
  'save-garden',
  'hidden-door',
] as const;
export type AdventureId = (typeof ADVENTURES)[number];

export const RELATIONSHIPS = ['mother', 'father', 'grandmother', 'grandfather', 'brother', 'sister', 'other'] as const;
export type RelationshipId = (typeof RELATIONSHIPS)[number];

export const CHARACTER_ROLES = ['adventure-partner', 'guide', 'explorer', 'magical-helper'] as const;
export type CharacterRoleId = (typeof CHARACTER_ROLES)[number];

/** Grammatical form used to agree French and Arabic text (il/elle, دخل/دخلت). */
export type GrammaticalForm = 'm' | 'f';

/** A photo kept on the device only: downscaled, re-encoded (EXIF stripped), never uploaded in demo mode. */
export interface LocalPhoto {
  dataUrl: string;
  width: number;
  height: number;
}

export interface ChildProfile {
  firstName: string;
  age: number;
  form: GrammaticalForm;
  photo?: LocalPhoto;
}

export interface StoryCharacter {
  id: string;
  name: string;
  relationship: RelationshipId;
  /** Free label when relationship is "other" (e.g. "Tata Samira", "parrain"). */
  relationshipLabel?: string;
  form: GrammaticalForm;
  role: CharacterRoleId;
  photo?: LocalPhoto;
}

export interface LearningObjective {
  id: LearningObjectiveId;
}

export interface ReadingLevel {
  id: ReadingLevelId;
  /** Ages for which the level is usually suggested. A suggestion only — never enforced. */
  suggestedAges: [number, number];
  /** Upper bound of sentence complexity tags included in the text (1–3). */
  depth: 1 | 2 | 3;
}

export interface StoryWorld {
  id: WorldId;
  palette: { sky: string; skyLow: string; ground: string; accent: string; glow: string; ink: string; cover: string };
}

export type StoryAdventure = { kind: 'mission'; id: AdventureId } | { kind: 'surprise' };

export interface StoryConfiguration {
  version: 1;
  child: ChildProfile;
  storyLanguage: StoryLanguage;
  readingLevel: ReadingLevelId;
  objective: LearningObjectiveId;
  world: WorldId;
  /** MVP supports one companion; the list keeps room for several later. */
  companions: StoryCharacter[];
  adventure: StoryAdventure;
  /** Parent's own idea. Stored and sent to a future writer; not used by demo templates. */
  customIdea?: string;
  dedication?: string;
}

/** The moment an illustration depicts; drives scene composition. */
export type SceneMoment = 'arrival' | 'meeting' | 'learning' | 'challenge' | 'triumph';

export interface SceneSpec {
  world: WorldId;
  moment: SceneMoment;
  /** Character ids present: "child" plus companion ids. */
  characters: string[];
}

export type StoryPageKind = 'dedication' | 'story' | 'learning' | 'ending';

export interface StoryPage {
  id: string;
  kind: StoryPageKind;
  /** 1-based number as printed in the book. */
  number: number;
  heading?: string;
  paragraphs: string[];
  scene: SceneSpec;
  /** A question the reader answers aloud with the child. */
  prompt?: string;
  /** Words or ideas highlighted on learning pages. */
  keywords?: string[];
}

export type StorybookSource = 'demo-template' | 'ai';

export interface Storybook {
  id: string;
  source: StorybookSource;
  /** True when only some pages exist (demo preview). */
  isSample: boolean;
  language: StoryLanguage;
  direction: 'ltr' | 'rtl';
  title: string;
  /** Short line under the title on the cover. */
  tagline: string;
  summary: string;
  learningGoals: string[];
  /** Resolved adventure (a "surprise" is resolved deterministically). */
  adventure: AdventureId;
  pages: StoryPage[];
  /** Pages a complete printed book is planned to have (for honest "sample" messaging). */
  plannedPageCount: number;
  config: StoryConfiguration;
}

export type BookFormatId = 'digital-pdf' | 'printed-softcover' | 'premium-hardcover';

export interface BookFormat {
  id: BookFormatId;
  physical: boolean;
  /** Price in minor units is overkill for MAD retail; whole dirhams. */
  price: number;
  currency: 'MAD';
  /** True until the business confirms real prices. Shown in the UI. */
  pricePlaceholder: boolean;
  pages: number;
  dimensionsCm?: string;
}

export interface DeliveryDetails {
  fullName: string;
  phone: string;
  email?: string;
  city: string;
  address: string;
  postalCode?: string;
  notes?: string;
}

export type OrderDraftStatus = 'draft' | 'demo-recorded';

export interface OrderDraft {
  id: string;
  status: OrderDraftStatus;
  formatId: BookFormatId;
  quantity: number;
  currency: 'MAD';
  /** Placeholder subtotal from config; shipping and taxes are quoted later. */
  subtotal: number;
  delivery?: DeliveryDetails;
  storyTitle: string;
  createdAt: string;
}
