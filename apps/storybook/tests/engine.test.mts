/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { composeSampleStorybook, resolveAdventure } from '../src/lib/engine/demo/compose.ts';
import { mechanicalReview } from '../src/lib/engine/demo/editor-checks.ts';
import { illustrationBriefs } from '../src/lib/engine/demo/illustration-briefs.ts';
import {
  ADVENTURES,
  CHARACTER_ROLES,
  LEARNING_OBJECTIVES,
  LOCALES,
  READING_LEVELS,
  WORLDS,
  type StoryConfiguration,
} from '../src/lib/engine/types.ts';

const base = (over: Partial<StoryConfiguration> = {}): StoryConfiguration => ({
  version: 1,
  child: { firstName: 'Lina', age: 5, form: 'f' },
  storyLanguage: 'fr',
  readingLevel: 'young-reader',
  objective: 'colors',
  world: 'enchanted-forest',
  companions: [],
  adventure: { kind: 'mission', id: 'lost-treasure' },
  ...over,
});

describe('demo story composer', () => {
  it('fills every template for every language, world, mission, objective, role and form', () => {
    let books = 0;
    for (const storyLanguage of LOCALES)
      for (const world of WORLDS)
        for (const id of ADVENTURES)
          for (const objective of LEARNING_OBJECTIVES)
            for (const role of [undefined, ...CHARACTER_ROLES])
              for (const form of ['m', 'f'] as const) {
                const book = composeSampleStorybook(
                  base({
                    storyLanguage,
                    world,
                    objective,
                    adventure: { kind: 'mission', id },
                    child: { firstName: 'Adam', age: 6, form },
                    readingLevel: 'confident-reader',
                    companions: role ? [{ id: 'c1', name: 'Maman', relationship: 'mother', form: 'f', role }] : [],
                  }),
                );
                const review = mechanicalReview(book);
                assert.ok(review.approved, `${storyLanguage}/${world}/${id}/${objective}/${role}: ${JSON.stringify(review.issues)}`);
                books++;
              }
    assert.equal(books, 3 * 6 * 6 * 9 * 5 * 2);
  });

  it('writes less at lower reading levels', () => {
    const words = (level: StoryConfiguration['readingLevel']) =>
      composeSampleStorybook(base({ readingLevel: level }))
        .pages.flatMap((p) => p.paragraphs)
        .join(' ')
        .split(/\s+/).length;
    const [a, b, c] = READING_LEVELS.map(words);
    assert.ok(a < b && b < c, `${a} < ${b} < ${c}`);
  });

  it('gives the companion a real part in the story', () => {
    const book = composeSampleStorybook(
      base({ companions: [{ id: 'c1', name: 'Papi Ahmed', relationship: 'grandfather', form: 'm', role: 'guide' }] }),
    );
    const mentions = book.pages.filter((p) => p.paragraphs.join(' ').includes('Papi Ahmed')).length;
    assert.ok(mentions >= 3, `companion appears on ${mentions} pages`);
    assert.match(book.summary, /Papi Ahmed/);
  });

  it('lets the objective change the learning page', () => {
    const a = composeSampleStorybook(base({ objective: 'numbers' }));
    const b = composeSampleStorybook(base({ objective: 'emotions' }));
    assert.notEqual(a.pages[3].paragraphs[0], b.pages[3].paragraphs[0]);
    assert.ok(a.pages[3].prompt && a.pages[3].keywords?.length);
  });

  it('agrees French and Arabic text with the hero form', () => {
    const fem = composeSampleStorybook(base({ child: { firstName: 'Lina', age: 5, form: 'f' } }));
    assert.match(fem.tagline, /l'héroïne/);
    const ar = composeSampleStorybook(base({ storyLanguage: 'ar', child: { firstName: 'آدم', age: 5, form: 'm' } }));
    assert.equal(ar.direction, 'rtl');
    assert.match(ar.tagline, /بطلُها/);
  });

  it('uses the dedication when given, and a default otherwise', () => {
    assert.equal(composeSampleStorybook(base({ dedication: 'Pour toi, ma lune.' })).pages[0].paragraphs[0], 'Pour toi, ma lune.');
    assert.match(composeSampleStorybook(base()).pages[0].paragraphs[0], /Lina/);
  });

  it('resolves "surprise" deterministically to a real mission', () => {
    const cfg = base({ adventure: { kind: 'surprise' } });
    const first = resolveAdventure(cfg);
    assert.ok(ADVENTURES.includes(first));
    assert.equal(resolveAdventure(cfg), first);
    assert.equal(composeSampleStorybook(cfg).id, composeSampleStorybook(cfg).id);
  });

  it('is honest about being a sample', () => {
    const book = composeSampleStorybook(base());
    assert.equal(book.source, 'demo-template');
    assert.equal(book.isSample, true);
    assert.ok(book.pages.length < book.plannedPageCount);
  });

  it('never puts photos into illustration briefs', () => {
    const photo = { dataUrl: 'data:image/jpeg;base64,AAAA', width: 1, height: 1 };
    const book = composeSampleStorybook(base({ child: { firstName: 'Lina', age: 5, form: 'f', photo } }));
    for (const brief of illustrationBriefs(book)) assert.doesNotMatch(brief.prompt, /data:image/);
  });
});
