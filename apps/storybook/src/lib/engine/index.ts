import { composeSampleStorybook } from './demo/compose';
import type { StoryConfiguration, Storybook } from './types';

/**
 * Which engine the app is wired to. Only "demo" exists today: books come from
 * hand-written templates and are always labelled as samples in the UI.
 * When a backend implements providers.ts, add an "api" mode here and call it
 * from a server route; the UI already treats `isSample` and `source` honestly.
 */
export const STORY_ENGINE_MODE = 'demo' as const;

export function previewStorybook(config: StoryConfiguration): Storybook {
  return composeSampleStorybook(config);
}

export * from './types';
