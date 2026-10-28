import type { Storybook } from '../types';
import type { IllustrationBrief } from '../providers';

const WORLD_ART: Record<Storybook['config']['world'], string> = {
  'enchanted-forest': 'an enchanted forest at dusk, tall trees, ferns, golden fireflies, lavender sky',
  space: 'a gentle space landscape, milk-white moon surface, ringed pink planet, deep midnight sky with stars',
  ocean: 'an underwater kingdom, light rays, coral gardens, bubbles, a distant mother-of-pearl palace',
  'dinosaur-valley': 'a lush prehistoric valley, giant ferns, a sleepy distant volcano, warm golden sky',
  'secret-garden': 'a walled secret garden, climbing roses, ivy, a small fountain, soft morning light',
  'magic-castle': 'a fairy-tale castle on a lavender hill, floating lanterns, sunset clouds',
};

const STYLE =
  'Premium children’s picture-book illustration, painterly gouache texture, warm sophisticated palette ' +
  '(ivory, midnight ink, sage, muted coral, lavender, warm gold), delicate details, expressive kind characters, no text.';

/**
 * Turns a storybook into image-generation briefs. Deterministic; this is the
 * part of the Illustration Director that needs no model. A real provider would
 * add character reference sheets and consistency seeds on top.
 *
 * Child photos are deliberately NOT referenced here: sending them to an image
 * service needs explicit parental consent and a vetted provider.
 */
export function illustrationBriefs(book: Storybook): IllustrationBrief[] {
  const companion = book.config.companions[0];
  return book.pages
    .filter((p) => p.kind !== 'dedication')
    .map((p) => ({
      pageId: p.id,
      scene: p.scene,
      prompt: [
        STYLE,
        `Setting: ${WORLD_ART[p.scene.world]}.`,
        `Moment: ${p.scene.moment}.`,
        `Main character: a ${book.config.child.age}-year-old child (the hero).`,
        companion ? `Also present: the child's ${companion.relationship} (${companion.role}).` : '',
        p.scene.characters.includes('creature') ? 'A small friendly magical creature of this world.' : '',
      ]
        .filter(Boolean)
        .join(' '),
      aspectRatio: '4:3' as const,
    }));
}
