'use client';

import { BookOpen, Info, Pencil, ShoppingBag } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { BookCover } from '@/components/book/BookCover';
import { BookSpread } from '@/components/book/BookSpread';
import { buttonClass } from '@/components/ui/button';
import { useI18n } from '@/i18n/client';
import { previewStorybook } from '@/lib/engine';
import { STUDIO_STEPS, toConfiguration, useStoryStore, type StudioStep } from '@/store/story';

const EDITABLE = STUDIO_STEPS.filter((id): id is Exclude<StudioStep, 'reveal'> => id !== 'reveal');

export function RevealStep() {
  const { t, dir } = useI18n();
  const reduce = useReducedMotion();
  const draft = useStoryStore((s) => s.draft);
  const goTo = useStoryStore((s) => s.goTo);
  const [editing, setEditing] = useState(false);
  const config = useMemo(() => toConfiguration(draft), [draft]);
  const book = useMemo(() => (config ? previewStorybook(config) : null), [config]);
  const s = t.studio.reveal;

  // An incomplete draft (e.g. edited storage) sends the parent back to the first unanswered page.
  useEffect(() => {
    if (config) return;
    const d = draft;
    const missing = !d.child.firstName || !d.child.age || !d.child.form ? 0 : !d.storyLanguage || !d.readingLevel ? 1 : !d.objective ? 2 : !d.world ? 3 : !d.companionChoice ? 4 : 5;
    goTo(missing, 0);
  }, [config, draft, goTo]);

  if (!book || !config) return null;
  const companion = config.companions[0];
  const facts = [
    { label: s.objective, value: t.catalog.objectives[config.objective].label },
    { label: s.language, value: t.languages[config.storyLanguage] },
    { label: s.level, value: t.catalog.levels[config.readingLevel].label },
    { label: s.companion, value: companion ? companion.name : s.noCompanion },
  ];

  return (
    <div className="mx-auto max-w-5xl pb-10">
      <div className="text-center">
        <motion.p initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="font-display text-lg text-gold-deep italic">
          {s.kicker}
        </motion.p>
        <motion.h1 initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="font-display mt-2 text-[2.2rem] leading-tight tracking-[-0.02em] sm:text-5xl">
          {s.title}
        </motion.h1>
      </div>

      <div className="mt-8 grid items-center gap-10 lg:grid-cols-[0.9fr_1fr] lg:gap-14">
        <div className="relative mx-auto w-full max-w-[340px] sm:max-w-[400px]">
          <motion.div
            className="absolute inset-[-12%] rounded-full bg-[radial-gradient(closest-side,rgb(232_188_117/0.55),transparent)]"
            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.3 }}
            aria-hidden
          />
          <BookCover
            entrance
            title={book.title}
            tagline={book.tagline}
            name={config.child.firstName}
            world={config.world}
            photo={config.child.photo}
            photoAlt={t.studio.photo.alt(config.child.firstName)}
            companion={!!companion}
            eyebrow="Hikaya"
            dir={book.direction}
            angle={22}
          />
        </div>

        <motion.div initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}>
          <h2 dir={book.direction} lang={book.language} className="font-display text-3xl leading-tight sm:text-4xl">
            {book.title}
          </h2>
          <p dir={book.direction} lang={book.language} className="mt-1 text-ink-muted italic">
            {book.tagline}
          </p>
          <p className="mt-6 text-[0.75rem] font-semibold tracking-[0.16em] text-ink-muted uppercase">{s.summary}</p>
          <p dir={book.direction} lang={book.language} className="mt-2 text-lg leading-relaxed text-ink-soft">
            {book.summary}
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-ink/10 py-5">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-[0.75rem] font-semibold tracking-[0.12em] text-ink-muted uppercase">{f.label}</dt>
                <dd className="mt-0.5 font-medium">{f.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 flex gap-2.5 rounded-2xl bg-lavender/50 p-4 text-[0.9rem] leading-snug text-ink-soft">
            <Info className="mt-0.5 size-4 shrink-0 text-lavender-deep" aria-hidden />
            {s.sampleNotice}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/preview" className={buttonClass('primary', 'lg')}>
              <BookOpen className="size-5" />
              {s.preview}
            </Link>
            <Link href="/order" className={buttonClass('gold', 'lg')}>
              <ShoppingBag className="size-5" />
              {s.order}
            </Link>
          </div>
          <button type="button" onClick={() => setEditing((v) => !v)} aria-expanded={editing} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full px-2 font-medium text-ink-soft underline-offset-4 hover:underline">
            <Pencil className="size-4" />
            {s.edit}
          </button>
          <AnimatePresence>
            {editing && (
              <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap gap-2 overflow-hidden pt-2">
                {EDITABLE.map((id, i) => (
                  <li key={id}>
                    <button type="button" onClick={() => goTo(i, 0)} className="min-h-10 rounded-full bg-ivory px-4 text-[0.92rem] ring-1 ring-ink/15 hover:ring-ink/40">
                      {s.editItems[id]}
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <section className="mt-14" aria-labelledby="spread-title">
        <h2 id="spread-title" className="mb-4 text-center text-[0.75rem] font-semibold tracking-[0.16em] text-ink-muted uppercase" dir={dir}>
          {s.spread}
        </h2>
        <BookSpread book={book} page={book.pages[1]} />
      </section>
    </div>
  );
}
