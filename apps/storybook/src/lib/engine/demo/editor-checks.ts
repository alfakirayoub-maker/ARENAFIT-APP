import { READING_LEVEL_CATALOG } from '@/config/catalog';

import type { EditorialReview } from '../providers';
import type { Storybook } from '../types';

/** Max words per sentence we accept for each reading depth. */
const MAX_SENTENCE_WORDS = { 1: 26, 2: 30, 3: 36 } as const;

/**
 * Mechanical checks a Story Editor always runs, whatever writes the text:
 * no unfilled template slots, the child's name present, sentence length fits
 * the reading level. Language quality and age suitability need a real editor.
 */
export function mechanicalReview(book: Storybook): EditorialReview {
  const issues: EditorialReview['issues'] = [];
  const name = book.config.child.firstName.trim();
  const depth = READING_LEVEL_CATALOG[book.config.readingLevel].depth;
  const text = [book.title, book.summary, ...book.pages.flatMap((p) => [...p.paragraphs, p.prompt ?? ''])];

  for (const chunk of text) {
    if (/undefined|null|\$\{|NaN/.test(chunk)) issues.push({ severity: 'error', message: `Unfilled template slot: "${chunk.slice(0, 60)}"` });
  }
  if (!book.title.includes(name)) issues.push({ severity: 'warning', message: 'Title does not contain the child’s name.' });
  for (const p of book.pages) {
    if (p.paragraphs.length === 0) issues.push({ severity: 'error', message: `Page ${p.number} is empty.` });
    for (const sentence of p.paragraphs.join(' ').split(/(?<=[.!?؟…»”])\s+/)) {
      const words = sentence.split(/\s+/).filter(Boolean).length;
      if (words > MAX_SENTENCE_WORDS[depth]) issues.push({ severity: 'warning', message: `Long sentence on page ${p.number} (${words} words).` });
    }
  }
  return { approved: !issues.some((i) => i.severity === 'error'), issues };
}
