import type { ReadingLevel, ReadingLevelId, StoryWorld, WorldId } from '@/lib/engine/types';

/**
 * Visual palette per world. Used by the SVG scenes, the book cover and the
 * Studio background, so a world choice recolours the whole experience.
 */
export const WORLD_CATALOG: Record<WorldId, StoryWorld> = {
  'enchanted-forest': {
    id: 'enchanted-forest',
    palette: { sky: '#cfc6ee', skyLow: '#f3d9c4', ground: '#4f6b55', accent: '#e8bc75', glow: '#fff1c9', ink: '#1f2b2a', cover: '#2f4a3f' },
  },
  space: {
    id: 'space',
    palette: { sky: '#141a2e', skyLow: '#3b3f74', ground: '#5d5a8f', accent: '#efaf9d', glow: '#dcd6f7', ink: '#0e1222', cover: '#1b2140' },
  },
  ocean: {
    id: 'ocean',
    palette: { sky: '#1d4e5c', skyLow: '#7fb3ad', ground: '#25414f', accent: '#efaf9d', glow: '#d9f0e6', ink: '#0f2a33', cover: '#1f4b58' },
  },
  'dinosaur-valley': {
    id: 'dinosaur-valley',
    palette: { sky: '#f2cf98', skyLow: '#f7e5c4', ground: '#7d8d55', accent: '#b4563d', glow: '#fff3d6', ink: '#3a3320', cover: '#6b5a2e' },
  },
  'secret-garden': {
    id: 'secret-garden',
    palette: { sky: '#e6efe0', skyLow: '#faf3e4', ground: '#86a77f', accent: '#efaf9d', glow: '#fffaf0', ink: '#29402c', cover: '#53704f' },
  },
  'magic-castle': {
    id: 'magic-castle',
    palette: { sky: '#b9afe6', skyLow: '#f4c3b2', ground: '#6a5fae', accent: '#e8bc75', glow: '#fff0d4', ink: '#24203f', cover: '#3d3570' },
  },
};

export const READING_LEVEL_CATALOG: Record<ReadingLevelId, ReadingLevel> = {
  'first-steps': { id: 'first-steps', suggestedAges: [2, 5], depth: 1 },
  'young-reader': { id: 'young-reader', suggestedAges: [5, 7], depth: 2 },
  'confident-reader': { id: 'confident-reader', suggestedAges: [7, 12], depth: 3 },
};

/** Suggests (never imposes) a reading level from age. */
export function suggestReadingLevel(age: number | undefined): ReadingLevelId | undefined {
  if (!age) return undefined;
  if (age <= 4) return 'first-steps';
  if (age <= 6) return 'young-reader';
  return 'confident-reader';
}

export const CHILD_AGE = { min: 2, max: 12 } as const;
export const TEXT_LIMITS = { name: 24, idea: 240, dedication: 280, relationshipLabel: 30 } as const;
