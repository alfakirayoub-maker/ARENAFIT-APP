'use client';

import { ArrowLeft, ArrowRight, Cloud, RotateCcw, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';

import { WorldScene } from '@/art/WorldScene';
import { BookCover } from '@/components/book/BookCover';
import { Logo } from '@/components/ui/Logo';
import { useI18n } from '@/i18n/client';
import { previewStorybook } from '@/lib/engine';
import { WORLDS, type WorldId } from '@/lib/engine/types';
import { useHydratedStores } from '@/store/hydration';
import { STUDIO_STEPS, toConfiguration, useStoryStore, type StoryDraft } from '@/store/story';

import { STEP_FORM_ID } from './StepFrame';
import { AdventureStep } from './steps/AdventureStep';
import { CompanionStep } from './steps/CompanionStep';
import { HeroStep } from './steps/HeroStep';
import { LanguageStep } from './steps/LanguageStep';
import { ObjectiveStep } from './steps/ObjectiveStep';
import { RevealStep } from './steps/RevealStep';
import { WorldStep } from './steps/WorldStep';

/** Number of sub-pages per step (a few steps ask a follow-up question on a second page). */
export function subPages(step: number, draft: StoryDraft): number {
  const id = STUDIO_STEPS[step];
  if (id === 'companion') return draft.companionChoice && draft.companionChoice !== 'none' ? 2 : 1;
  if (id === 'adventure') return 2;
  return 1;
}

export function Studio() {
  const ready = useHydratedStores();
  const { t, dir, locale } = useI18n();
  const reduce = useReducedMotion();
  const params = useSearchParams();
  const { draft, step, sub, reached, goTo, update, reset } = useStoryStore();

  // "Choose this world" links from the homepage preselect the world.
  useEffect(() => {
    const w = params.get('world');
    if (ready && w && (WORLDS as readonly string[]).includes(w) && !useStoryStore.getState().draft.world) update({ world: w as WorldId });
  }, [ready, params, update]);

  const total = STUDIO_STEPS.length;
  const isReveal = STUDIO_STEPS[step] === 'reveal';

  const next = () => {
    if (sub < subPages(step, draft) - 1) goTo(step, sub + 1);
    else goTo(Math.min(step + 1, total - 1), 0);
  };
  const back = () => {
    if (sub > 0) goTo(step, sub - 1);
    else if (step > 0) goTo(step - 1, subPages(step - 1, draft) - 1);
  };

  // A cover that grows with each answer (desktop side page and mobile ribbon).
  const preview = useMemo(() => {
    const config = toConfiguration(draft);
    const name = draft.child.firstName.trim();
    return {
      title: config ? previewStorybook(config).title : name || t.studio.title,
      name,
      world: draft.world ?? 'enchanted-forest',
      photo: draft.child.photoConsent ? draft.child.photo : undefined,
      companion: !!draft.companionChoice && draft.companionChoice !== 'none',
    };
  }, [draft, t.studio.title]);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <p className="font-display animate-pulse text-xl text-ink-muted">{t.studio.loading}</p>
      </div>
    );
  }

  const StepView = [HeroStep, LanguageStep, ObjectiveStep, WorldStep, CompanionStep, AdventureStep, RevealStep][step];
  const forward = dir === 'rtl' ? -1 : 1;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      {/* Ambient world: the whole studio takes on the chosen world's light. */}
      <AnimatePresence>
        {draft.world && (
          <motion.div key={draft.world} className="pointer-events-none fixed inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} aria-hidden>
            <WorldScene world={draft.world} characters={false} animated={false} className="size-full opacity-25" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(250_247_240/0.55),rgb(250_247_240/0.9)_45%,rgb(250_247_240/0.97))]" />
          </motion.div>
        )}
      </AnimatePresence>
      {!draft.world && <div className="pointer-events-none fixed -top-32 -right-24 size-96 rounded-full bg-lavender/60 blur-3xl" aria-hidden />}

      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between gap-3 px-4 sm:h-16 sm:px-8">
        <Link href="/" className="rounded-lg" aria-label={t.nav.home}>
          <Logo locale={locale} className="[&>span:last-child]:text-xl" />
        </Link>
        <div className="flex items-center gap-1">
          <span className="hidden items-center gap-1.5 text-[0.8rem] text-ink-muted md:flex">
            <Cloud className="size-4" aria-hidden /> {t.studio.saved}
          </span>
          <button
            type="button"
            onClick={() => window.confirm(t.studio.restartConfirm) && reset()}
            className="grid size-11 place-items-center rounded-full text-ink-soft hover:bg-ink/5"
            aria-label={t.studio.restart}
            title={t.studio.restart}
          >
            <RotateCcw className="size-5" />
          </button>
          <Link href="/" className="grid size-11 place-items-center rounded-full text-ink-soft hover:bg-ink/5" aria-label={t.studio.exit} title={t.studio.exit}>
            <X className="size-5" />
          </Link>
        </div>
      </header>

      {/* Discreet progress: one gold segment per page of the book. */}
      <div className="relative z-10 shrink-0 px-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <ol className="flex flex-1 gap-1.5" aria-label={t.studio.stepOf(step + 1, total)}>
            {STUDIO_STEPS.map((s, i) => {
              const canJump = i <= reached;
              return (
                <li key={s} className="flex-1">
                  <button
                    type="button"
                    disabled={!canJump || i === step}
                    onClick={() => goTo(i, 0)}
                    aria-current={i === step ? 'step' : undefined}
                    aria-label={`${t.studio.stepOf(i + 1, total)}`}
                    className="block w-full py-2 disabled:cursor-default"
                  >
                    <span className={`block h-1 rounded-full transition-colors duration-500 ${i < step ? 'bg-gold-deep/70' : i === step ? 'bg-gold' : 'bg-ink/10'}`} />
                  </button>
                </li>
              );
            })}
          </ol>
          <span className="text-[0.8rem] font-medium whitespace-nowrap text-ink-muted tabular-nums">{t.studio.stepOf(step + 1, total)}</span>
        </div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-6xl flex-1 gap-10 px-4 sm:px-8 lg:pt-6">
        {/* Desktop: the book on the left page, growing with every answer. */}
        {!isReveal && (
          <aside className="hidden w-[38%] shrink-0 items-center justify-center lg:flex" aria-hidden>
            <div className="w-full max-w-sm">
              <BookCover title={preview.title} name={preview.name} world={preview.world} photo={preview.photo} companion={preview.companion} eyebrow="Hikaya" dir={dir} angle={20} />
            </div>
          </aside>
        )}

        <main className="relative min-h-0 flex-1" style={{ perspective: '1600px' }}>
          <AnimatePresence mode="wait" initial={false} custom={forward}>
            <motion.div
              key={`${step}-${sub}`}
              className="absolute inset-0 overflow-y-auto overscroll-contain pt-4 pb-8 [scrollbar-width:thin]"
              style={{ transformOrigin: dir === 'rtl' ? 'right center' : 'left center' }}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 36 * forward, rotateY: -8 * forward }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 * forward, rotateY: 6 * forward }}
              transition={{ duration: reduce ? 0.15 : 0.32, ease: [0.22, 0.8, 0.24, 1] }}
            >
              <StepView sub={sub} onNext={next} />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {!isReveal && (
        <footer className="relative z-10 shrink-0 border-t border-ink/8 bg-ivory/85 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 lg:ps-[calc(38%+2.5rem)]">
            <button
              type="button"
              onClick={back}
              disabled={step === 0 && sub === 0}
              className="inline-flex min-h-13 items-center gap-2 rounded-full px-4 font-medium text-ink-soft transition hover:bg-ink/5 disabled:invisible"
            >
              <ArrowLeft className="size-5 rtl:-scale-x-100" />
              {t.studio.back}
            </button>
            <button
              type="submit"
              form={STEP_FORM_ID}
              className="inline-flex min-h-13 flex-1 items-center justify-center gap-2 rounded-full bg-ink px-7 font-medium text-ivory shadow-[0_10px_24px_-12px_rgb(32_38_61/0.7)] transition hover:bg-ink-soft active:scale-[0.98] sm:flex-none"
            >
              {t.studio.next}
              <ArrowRight className="size-5 rtl:-scale-x-100" />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
