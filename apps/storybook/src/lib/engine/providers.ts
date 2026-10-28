/**
 * Provider boundaries for the future storytelling engine.
 *
 * Each role is an interface only. Nothing here calls a model: when a real
 * service is connected (server-side, behind an API route — never from the
 * browser with a secret key), implement these interfaces and pass them to
 * `createStoryPipeline`. Until then the app uses the demo templates in ./demo.
 */
import type {
  AdventureId,
  BookFormat,
  LearningObjectiveId,
  ReadingLevelId,
  SceneMoment,
  SceneSpec,
  StoryConfiguration,
  StoryPage,
  Storybook,
} from './types';

/** Story Architect — the narrative skeleton: beats, stakes, where the companion matters. */
export interface StoryOutline {
  adventure: AdventureId;
  title: string;
  beats: { moment: SceneMoment; purpose: string; characters: string[] }[];
}
export interface StoryArchitect {
  outline(config: StoryConfiguration): Promise<StoryOutline>;
}

/** Educational Designer — what is taught, at which level, with which words. */
export interface LearningPlan {
  objective: LearningObjectiveId;
  readingLevel: ReadingLevelId;
  targetWords: string[];
  maxSentenceWords: number;
  /** Questions the adult can ask the child while reading. */
  discussionPrompts: string[];
}
export interface EducationalDesigner {
  plan(config: StoryConfiguration, outline: StoryOutline): Promise<LearningPlan>;
}

/** Creative Writer — the actual pages. */
export interface StoryManuscript {
  title: string;
  tagline: string;
  summary: string;
  pages: StoryPage[];
}
export interface CreativeWriter {
  write(config: StoryConfiguration, outline: StoryOutline, plan: LearningPlan): Promise<StoryManuscript>;
}

/** Story Editor — consistency, age suitability, language quality. */
export interface EditorialReview {
  approved: boolean;
  issues: { severity: 'error' | 'warning'; message: string; pageId?: string }[];
}
export interface StoryEditor {
  review(book: Storybook): Promise<EditorialReview>;
}

/** Illustration Director — character and scene specifications for image generation. */
export interface IllustrationBrief {
  pageId: string;
  scene: SceneSpec;
  prompt: string;
  aspectRatio: '4:3' | '1:1' | '3:4';
}
export interface IllustrationDirector {
  direct(book: Storybook): Promise<IllustrationBrief[]>;
}

/** Publishing Engine — print-ready output (PDF with bleed, cover wrap, printer job). */
export interface PrintJobSpec {
  bookId: string;
  format: BookFormat['id'];
  interiorPdfUrl: string;
  coverPdfUrl?: string;
  pageCount: number;
}
export interface PublishingEngine {
  prepare(book: Storybook, format: BookFormat): Promise<PrintJobSpec>;
}

export interface StoryProviders {
  architect: StoryArchitect;
  educator: EducationalDesigner;
  writer: CreativeWriter;
  editor: StoryEditor;
  illustrator: IllustrationDirector;
}

export interface PipelineResult {
  book: Storybook;
  review: EditorialReview;
  illustrations: IllustrationBrief[];
}

/**
 * Orchestrates the roles in order. Kept provider-agnostic so a real backend
 * can mix vendors (e.g. one model for writing, another for illustration).
 */
export function createStoryPipeline(p: StoryProviders) {
  return async function compose(config: StoryConfiguration, plannedPageCount: number): Promise<PipelineResult> {
    const outline = await p.architect.outline(config);
    const plan = await p.educator.plan(config, outline);
    const manuscript = await p.writer.write(config, outline, plan);
    const book: Storybook = {
      id: crypto.randomUUID(),
      source: 'ai',
      isSample: manuscript.pages.length < plannedPageCount,
      language: config.storyLanguage,
      direction: config.storyLanguage === 'ar' ? 'rtl' : 'ltr',
      title: manuscript.title,
      tagline: manuscript.tagline,
      summary: manuscript.summary,
      learningGoals: [plan.objective],
      adventure: outline.adventure,
      pages: manuscript.pages,
      plannedPageCount,
      config,
    };
    const review = await p.editor.review(book);
    const illustrations = review.approved ? await p.illustrator.direct(book) : [];
    return { book, review, illustrations };
  };
}
