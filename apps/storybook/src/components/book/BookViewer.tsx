'use client';

import { ArrowLeft, ArrowRight, BookOpen, Pencil, ShoppingBag, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'motion/react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { buttonClass } from '@/components/ui/button';
import { useI18n } from '@/i18n/client';
import { previewStorybook } from '@/lib/engine';
import { useHydratedStores } from '@/store/hydration';
import { toConfiguration, useStoryStore } from '@/store/story';

import { BookCover } from './BookCover';
import { BookSpread } from './BookSpread';

/** Reading room: cover, sample spreads, then an honest end-of-sample page. */
export function BookViewer() {
  const ready = useHydratedStores();
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const draft = useStoryStore((s) => s.draft);
  const book = useMemo(() => {
    const config = toConfiguration(draft);
    return config ? previewStorybook(config) : null;
  }, [draft]);
  const [[index, direction], setPage] = useState<[number, number]>([0, 0]);

  const count = book ? book.pages.length + 2 : 0; // cover + pages + end
  const go = useCallback((delta: number) => setPage(([i]) => [Math.min(count - 1, Math.max(0, i + delta)), delta]), [count]);
  const rtl = book?.direction === 'rtl';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight') go(rtl ? -1 : 1);
      if (e.key === 'ArrowLeft') go(rtl ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, rtl]);

  if (!ready) return <div className="min-h-dvh bg-night" aria-busy="true" />;

  if (!book) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="max-w-sm">
          <BookOpen className="mx-auto size-10 text-gold-deep" />
          <h1 className="font-display mt-4 text-3xl">{t.order.emptyTitle}</h1>
          <p className="mt-3 text-ink-soft">{t.order.emptyBody}</p>
          <Link href="/create" className={buttonClass('primary', 'lg', 'mt-8')}>
            {t.nav.create}
          </Link>
        </div>
      </main>
    );
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const swipe = info.offset.x + info.velocity.x * 0.2;
    if (Math.abs(swipe) < 60) return;
    const forward = rtl ? swipe > 0 : swipe < 0;
    go(forward ? 1 : -1);
  };

  // Pages turn around the spine: forward pages swing in from the opening edge.
  const sign = rtl ? -1 : 1;
  const variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, rotateY: d >= 0 ? -70 * sign : 70 * sign, x: d >= 0 ? 30 * sign : -30 * sign }),
    center: { opacity: 1, rotateY: 0, x: 0 },
    exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, rotateY: d >= 0 ? 50 * sign : -50 * sign, x: d >= 0 ? -30 * sign : 30 * sign }),
  };

  const isCover = index === 0;
  const isEnd = index === count - 1;
  const page = !isCover && !isEnd ? book.pages[index - 1] : null;

  return (
    <div className="relative flex min-h-dvh flex-col bg-night text-ivory">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgb(106_95_174/0.35),transparent_60%)]" aria-hidden />

      <header className="relative z-10 flex h-16 items-center justify-between gap-3 px-4 sm:px-8">
        <Link href="/create" className="grid size-11 place-items-center rounded-full hover:bg-ivory/10" aria-label={t.book.close}>
          <X className="size-5" />
        </Link>
        <div className="min-w-0 text-center">
          <p className="truncate text-[0.95rem] font-medium" dir={book.direction}>
            {book.title}
          </p>
          <p className="inline-flex items-center gap-1 text-[0.75rem] text-gold">
            <Sparkles className="size-3" /> {t.demo.sample} · {t.demo.illustrations}
          </p>
        </div>
        <span className="w-11" />
      </header>

      <main className="relative z-10 flex flex-1 flex-col px-3 pb-4 sm:px-8" aria-roledescription="carousel" aria-label={t.book.title}>
        <div className="relative mx-auto flex w-full max-w-5xl flex-1 items-center justify-center" style={{ perspective: '2000px' }}>
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={index}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reduce ? 0.15 : 0.55, ease: [0.22, 0.8, 0.24, 1] }}
              style={{ transformOrigin: rtl ? 'right center' : 'left center' }}
              drag={reduce ? false : 'x'}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={onDragEnd}
              className="w-full touch-pan-y py-4"
              aria-roledescription="slide"
              aria-label={isCover ? t.book.cover : isEnd ? t.book.sampleEnd : t.book.page(page!.number)}
            >
              {isCover && (
                <div className="mx-auto w-full max-w-[min(440px,58dvh)]">
                  <BookCover
                    title={book.title}
                    tagline={book.tagline}
                    name={book.config.child.firstName}
                    world={book.config.world}
                    photo={book.config.child.photo}
                    photoAlt={t.studio.photo.alt(book.config.child.firstName)}
                    companion={book.config.companions.length > 0}
                    eyebrow="Hikaya"
                    dir={book.direction}
                    angle={14}
                  />
                </div>
              )}
              {page && <BookSpread book={book} page={page} className="text-ink" />}
              {isEnd && (
                <div className="mx-auto max-w-xl rounded-[var(--radius-page)] bg-ivory p-8 text-center text-ink shadow-[var(--shadow-book)] sm:p-12">
                  <Sparkles className="mx-auto size-8 text-gold" />
                  <h2 className="font-display mt-4 text-3xl">{t.book.sampleEnd}</h2>
                  <p className="mt-4 leading-relaxed text-ink-soft">{t.book.sampleEndBody(book.plannedPageCount)}</p>
                  <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                    <Link href="/order" className={buttonClass('gold', 'lg')}>
                      <ShoppingBag className="size-5" /> {t.studio.reveal.order}
                    </Link>
                    <Link href="/create" className={buttonClass('secondary', 'lg')}>
                      <Pencil className="size-5" /> {t.studio.reveal.edit}
                    </Link>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <nav
          dir={book.direction}
          className="sticky bottom-0 z-10 -mx-3 mt-2 flex items-center justify-between gap-4 bg-[linear-gradient(to_top,var(--color-night)_65%,transparent)] px-[max(0.75rem,calc((100%-28rem)/2))] pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-8"
          aria-label={t.book.title}
        >
          <button type="button" onClick={() => go(-1)} disabled={index === 0} className="grid size-13 place-items-center rounded-full bg-ivory/10 ring-1 ring-ivory/20 transition hover:bg-ivory/20 disabled:opacity-30" aria-label={t.book.prev}>
            <ArrowLeft className="size-5 rtl:-scale-x-100" />
          </button>
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1.5" aria-hidden>
              {Array.from({ length: count }).map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-gold' : 'w-1.5 bg-ivory/30'}`} />
              ))}
            </div>
            <p className="text-[0.8rem] text-ivory/70 tabular-nums" aria-live="polite">
              {t.book.of(index + 1, count)}
              <span className="md:hidden"> · {t.book.swipe}</span>
            </p>
          </div>
          <button type="button" onClick={() => go(1)} disabled={isEnd} className="grid size-13 place-items-center rounded-full bg-gold text-ink transition hover:bg-[#efc88a] disabled:opacity-30" aria-label={t.book.next}>
            <ArrowRight className="size-5 rtl:-scale-x-100" />
          </button>
        </nav>
              </main>
    </div>
  );
}
