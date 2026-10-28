'use client';

import { MessageCircleQuestion, Sparkles } from 'lucide-react';

import { WorldScene } from '@/art/WorldScene';
import { WORLD_CATALOG } from '@/config/catalog';
import { MESSAGES } from '@/i18n';
import { useI18n } from '@/i18n/client';
import type { Storybook, StoryPage } from '@/lib/engine/types';

const TEXT_SIZE = { 'first-steps': 'text-[1.32rem] sm:text-[1.45rem] leading-[1.55]', 'young-reader': 'text-[1.16rem] sm:text-[1.25rem] leading-[1.6]', 'confident-reader': 'text-[1.06rem] sm:text-[1.12rem] leading-[1.65]' } as const;

/**
 * One double page of the book: illustration on one side, text on the other
 * (mirrored for Arabic books). Stacks into a single page on phones.
 */
export function BookSpread({ book, page, className = '' }: { book: Storybook; page: StoryPage; className?: string }) {
  const { t, dir, locale } = useI18n();
  // Labels printed in the book follow the story language; UI notes follow the interface.
  const bt = MESSAGES[book.language].book;
  const p = WORLD_CATALOG[book.config.world].palette;
  const companion = book.config.companions.length > 0;
  const isDedication = page.kind === 'dedication';
  const usesDefaultDedication = isDedication && !book.config.dedication;

  return (
    <article dir={book.direction} lang={book.language} className={`grid overflow-hidden rounded-[var(--radius-page)] bg-ivory shadow-[var(--shadow-book)] ring-1 ring-ink/5 md:grid-cols-2 ${className}`}>
      {/* illustration page */}
      <div className="relative aspect-[4/3] overflow-hidden md:aspect-auto md:min-h-[420px]" style={{ background: p.cover }}>
        {isDedication ? (
          <div className="grain absolute inset-0 grid place-items-center" style={{ background: `radial-gradient(circle at 50% 40%, ${p.glow}55, ${p.cover})` }}>
            <svg viewBox="0 0 120 120" className="size-28 opacity-90" aria-hidden>
              <circle cx="60" cy="60" r="44" fill="none" stroke="#e8bc75" strokeWidth="1.2" strokeDasharray="2 5" />
              <path d="M60 22 L66 54 L98 60 L66 66 L60 98 L54 66 L22 60 L54 54 Z" fill="#e8bc75" />
            </svg>
          </div>
        ) : (
          <WorldScene world={page.scene.world} moment={page.scene.moment} companion={companion} className="absolute inset-0 size-full" />
        )}
        {/* gutter shading toward the spine */}
        <div className="pointer-events-none absolute inset-y-0 end-0 hidden w-10 bg-[linear-gradient(to_left,rgb(32_38_61/0.25),transparent)] md:block rtl:bg-[linear-gradient(to_right,rgb(32_38_61/0.25),transparent)]" />
      </div>

      {/* text page */}
      <div className="relative flex flex-col px-6 pt-7 pb-6 sm:px-10 sm:pt-10">
        <div className="pointer-events-none absolute inset-y-0 start-0 hidden w-8 bg-[linear-gradient(to_right,rgb(32_38_61/0.08),transparent)] md:block rtl:bg-[linear-gradient(to_left,rgb(32_38_61/0.08),transparent)]" />
        {page.heading && <p className="text-[0.72rem] font-semibold tracking-[0.2em] text-gold-deep uppercase">{page.heading}</p>}
        <div className={`font-display mt-4 space-y-4 text-ink ${isDedication ? 'my-auto text-center text-2xl leading-relaxed italic' : TEXT_SIZE[book.config.readingLevel]}`}>
          {page.paragraphs.map((para, i) => (
            <p key={i} className={!isDedication && i === 0 && page.number === 2 ? 'first-letter:float-start first-letter:me-2 first-letter:text-[3.4em] first-letter:leading-[0.8] first-letter:text-coral-deep' : ''}>
              {para}
            </p>
          ))}
        </div>
        {usesDefaultDedication && (
          <p lang={locale} dir={dir} className="mt-4 text-center text-[0.8rem] text-ink-muted">
            {t.book.dedicationDefault}
          </p>
        )}

        {page.keywords && (
          <div className="mt-6">
            <p className="text-[0.72rem] font-semibold tracking-[0.16em] text-ink-muted uppercase">{bt.keywords}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {page.keywords.map((k) => (
                <li key={k} className="rounded-full bg-sage/50 px-3 py-1 text-[0.9rem]">
                  {k}
                </li>
              ))}
            </ul>
          </div>
        )}
        {page.prompt && (
          <div className="mt-5 flex gap-3 rounded-2xl bg-lavender/55 p-4">
            <MessageCircleQuestion className="mt-0.5 size-5 shrink-0 text-lavender-deep" aria-hidden />
            <div>
              <p className="text-[0.75rem] font-semibold tracking-[0.12em] text-lavender-deep uppercase">{bt.prompt}</p>
              <p className="mt-1 leading-snug">{page.prompt}</p>
            </div>
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-6 text-[0.8rem] text-ink-muted">
          <span lang={locale} dir={dir} className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-gold" aria-hidden />
            {t.demo.sample}
          </span>
          <span className="font-display tabular-nums">{page.number}</span>
        </div>
      </div>
    </article>
  );
}
