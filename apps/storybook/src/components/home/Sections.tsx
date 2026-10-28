import { ArrowRight, BookOpen, Feather, Heart, Package, Printer, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { WorldScene } from '@/art/WorldScene';
import { BookCover } from '@/components/book/BookCover';
import { buttonClass } from '@/components/ui/button';
import { Reveal } from '@/components/ui/Reveal';
import type { Messages } from '@/i18n';
import { LEARNING_OBJECTIVES, READING_LEVELS, WORLDS, type Locale } from '@/lib/engine/types';

import { HeroBook } from './HeroBook';

type P = { t: Messages; locale: Locale };

function Eyebrow({ children, tone = 'dark' }: { children: React.ReactNode; tone?: 'dark' | 'light' }) {
  return (
    <p className={`flex items-center gap-3 text-[0.78rem] font-semibold tracking-[0.2em] uppercase ${tone === 'light' ? 'text-gold' : 'text-gold-deep'}`}>
      <span className="h-px w-8 bg-current opacity-60" />
      {children}
    </p>
  );
}

export function Hero({ t, locale }: P) {
  return (
    <section className="relative overflow-hidden pt-24 pb-14 sm:pt-32 lg:pt-36 lg:pb-24">
      <div className="pointer-events-none absolute -top-40 -right-32 size-[34rem] rounded-full bg-lavender/60 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute top-1/2 -left-40 size-[26rem] rounded-full bg-coral/25 blur-3xl" aria-hidden />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-6">
        {/* Not wrapped in <Reveal>: the headline is the LCP element and must paint immediately. */}
        <div className="relative z-10 max-w-2xl">
          <p className="text-[0.8rem] font-medium tracking-[0.08em] text-ink-muted">{t.hero.eyebrow}</p>
          <h1 className="font-display mt-5 text-[2.6rem] leading-[1.02] tracking-[-0.025em] text-balance sm:text-6xl lg:text-[4.6rem]">
            {t.hero.titleStart} <span className="ink-underline italic">{t.hero.titleHighlight}</span> {t.hero.titleEnd}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">{t.hero.body}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/create" className={buttonClass('primary', 'lg')}>
              {t.hero.primary}
              <ArrowRight className="size-5 rtl:-scale-x-100" />
            </Link>
            <a href="#magie" className={buttonClass('secondary', 'lg')}>
              <Sparkles className="size-5 text-gold-deep" />
              {t.hero.secondary}
            </a>
          </div>
        </div>
        <div className="relative -mx-2 sm:mx-0">
          <HeroBook name={t.hero.bookName} title={t.hero.bookTitle} kicker={t.studio.hero.kicker} rtl={locale === 'ar'} />
        </div>
      </div>
      <Reveal className="relative mx-auto mt-10 max-w-7xl px-4 sm:px-8 lg:mt-4" delay={0.2}>
        <p className="font-display max-w-xl border-s-2 border-gold ps-5 text-lg leading-snug text-ink-soft italic sm:text-xl">{t.hero.promise}</p>
      </Reveal>
    </section>
  );
}

export function Intro({ t }: P) {
  return (
    <section id="magie" className="relative scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-8">
        <Reveal>
          <div className="mx-auto flex justify-center">
            <Eyebrow>{t.intro.eyebrow}</Eyebrow>
          </div>
          <blockquote className="font-display mx-auto mt-8 max-w-4xl text-[2rem] leading-[1.12] tracking-[-0.02em] text-balance sm:text-5xl">
            <span className="text-gold" aria-hidden>
              “
            </span>
            {t.intro.quote}
          </blockquote>
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-3xl gap-6 text-start text-lg leading-relaxed text-ink-soft sm:grid-cols-2 sm:gap-10">
          {t.intro.body.map((para, i) => (
            <Reveal key={i} delay={0.1 * i}>
              <p className={i === 0 ? 'first-letter:font-display first-letter:float-start first-letter:me-2 first-letter:text-6xl first-letter:leading-[0.85] first-letter:text-coral-deep' : ''}>{para}</p>
            </Reveal>
          ))}
        </div>
        <p className="mt-12 text-sm font-medium tracking-[0.3em] text-ink-muted uppercase">{t.intro.signature}</p>
      </div>
    </section>
  );
}

const STEP_WORLDS = ['secret-garden', 'space', 'magic-castle'] as const;

export function Steps({ t }: P) {
  return (
    <section id="comment" className="relative scroll-mt-20 overflow-hidden bg-paper py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <Reveal className="max-w-2xl">
          <Eyebrow>{t.steps.eyebrow}</Eyebrow>
          <h2 className="font-display mt-5 text-4xl leading-[1.05] tracking-[-0.02em] sm:text-6xl">{t.steps.title}</h2>
        </Reveal>
        <ol className="relative mt-14 grid gap-14 lg:grid-cols-3 lg:gap-10">
          {/* golden thread linking the three pages */}
          <svg className="pointer-events-none absolute top-24 hidden h-24 w-full lg:block" viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden>
            <path d="M120 60 C320 0 480 110 640 50 S980 10 1100 60" fill="none" stroke="#e8bc75" strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round" />
          </svg>
          {t.steps.items.map((step, i) => (
            <Reveal key={i} delay={0.12 * i} className={i === 1 ? 'lg:mt-16' : i === 2 ? 'lg:mt-6' : ''}>
              <li className="relative">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-page)] shadow-[var(--shadow-soft)] ring-1 ring-ink/5">
                  <WorldScene world={STEP_WORLDS[i]} moment={(['arrival', 'learning', 'triumph'] as const)[i]} companion={i === 1} className="size-full" />
                  <span className="font-display absolute start-4 top-3 text-6xl text-ivory/95 drop-shadow-[0_2px_10px_rgb(32_38_61/0.35)]">{['I', 'II', 'III'][i]}</span>
                </div>
                <h3 className="font-display mt-6 text-2xl sm:text-3xl">{step.title}</h3>
                <p className="mt-3 max-w-sm text-lg leading-relaxed text-ink-soft">{step.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
        <div className="mt-14 flex justify-center lg:justify-start">
          <Link href="/create" className={buttonClass('primary', 'lg')}>
            {t.steps.cta}
            <ArrowRight className="size-5 rtl:-scale-x-100" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Learn({ t }: P) {
  return (
    <section id="apprendre" className="relative scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-14 px-4 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-20">
        <Reveal>
          <Eyebrow>{t.learn.eyebrow}</Eyebrow>
          <h2 className="font-display mt-5 text-4xl leading-[1.05] tracking-[-0.02em] text-balance sm:text-5xl">{t.learn.title}</h2>
          <p className="mt-6 text-lg leading-relaxed text-ink-soft">{t.learn.body}</p>
          <h3 className="mt-10 text-sm font-semibold tracking-[0.16em] text-ink-muted uppercase">{t.learn.objectivesTitle}</h3>
          <ul className="mt-4 flex flex-wrap gap-2">
            {LEARNING_OBJECTIVES.map((o) => (
              <li key={o} className="rounded-full bg-sage/45 px-4 py-2 text-[0.95rem] text-ink">
                {t.catalog.objectives[o].label}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.15}>
          {/* a book page set in three languages */}
          <div className="relative rounded-[var(--radius-page)] bg-ivory p-7 shadow-[var(--shadow-book)] ring-1 ring-ink/5 sm:p-10">
            <div className="absolute inset-y-6 start-0 w-3 rounded-full bg-[linear-gradient(90deg,rgb(32_38_61/0.12),transparent)]" aria-hidden />
            <p className="flex items-center gap-2 text-sm font-semibold text-lavender-deep">
              <BookOpen className="size-4" />
              {t.learn.langTitle}
            </p>
            <p className="mt-3 leading-relaxed text-ink-soft">{t.learn.langBody}</p>
            <div className="mt-8 divide-y divide-ink/10">
              {(['fr', 'en', 'ar'] as const).map((l) => (
                <div key={l} className="flex items-baseline gap-4 py-4">
                  <span className="w-16 shrink-0 text-xs font-semibold tracking-[0.14em] text-gold-deep uppercase">{t.languages[l]}</span>
                  <p lang={l} dir={l === 'ar' ? 'rtl' : 'ltr'} className="font-display flex-1 text-xl leading-snug sm:text-2xl">
                    {t.learn.samples[l]}
                  </p>
                </div>
              ))}
            </div>
            <h3 className="mt-8 text-sm font-semibold tracking-[0.16em] text-ink-muted uppercase">{t.learn.levelsTitle}</h3>
            <ol className="mt-4 grid gap-3 sm:grid-cols-3">
              {READING_LEVELS.map((lv, i) => (
                <li key={lv} className="rounded-2xl bg-paper p-4">
                  <span className="flex gap-1" aria-hidden>
                    {[0, 1, 2].map((k) => (
                      <span key={k} className={`h-1.5 w-5 rounded-full ${k <= i ? 'bg-gold' : 'bg-ink/10'}`} />
                    ))}
                  </span>
                  <span className="mt-3 block font-medium">{t.catalog.levels[lv].label}</span>
                  <span className="mt-1 block text-sm text-ink-muted">{t.catalog.levels[lv].hint}</span>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Family({ t }: P) {
  return (
    <section className="relative overflow-hidden bg-night py-20 text-ivory sm:py-28">
      <div className="pointer-events-none absolute -top-24 end-0 size-[30rem] rounded-full bg-lavender-deep/30 blur-3xl" aria-hidden />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-20">
        <Reveal className="order-2 lg:order-1">
          <div className="relative mx-auto aspect-[4/5] max-w-md overflow-hidden rounded-t-[999px] rounded-b-[var(--radius-page)] ring-1 ring-gold/40">
            <WorldScene world="enchanted-forest" moment="meeting" companion className="size-full" />
          </div>
        </Reveal>
        <Reveal className="order-1 lg:order-2">
          <Eyebrow tone="light">{t.family.eyebrow}</Eyebrow>
          <h2 className="font-display mt-5 text-4xl leading-[1.05] tracking-[-0.02em] text-balance sm:text-5xl">{t.family.title}</h2>
          <p className="mt-6 text-lg leading-relaxed text-ivory/80">{t.family.body}</p>
          <figure className="mt-10 border-s-2 border-gold ps-6">
            <blockquote className="font-display text-2xl leading-snug italic sm:text-3xl">{t.family.example}</blockquote>
            <figcaption className="mt-3 text-sm text-ivory/60">{t.family.exampleCaption}</figcaption>
          </figure>
          <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-3 text-ivory/90">
            {t.family.roles.map((r, i) => {
              const Icon = [Heart, BookOpen, Feather, Sparkles][i % 4];
              return (
                <li key={r} className="flex items-center gap-3">
                  <Icon className="size-4 shrink-0 text-gold" />
                  <span>{r}</span>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

export function Showcase({ t, locale }: P) {
  return (
    <section id="histoires" className="relative scroll-mt-20 overflow-hidden py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <Reveal className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <Eyebrow>{t.showcase.eyebrow}</Eyebrow>
            <h2 className="font-display mt-5 text-4xl leading-[1.05] tracking-[-0.02em] text-balance sm:text-6xl">{t.showcase.title}</h2>
          </div>
          <p className="text-lg leading-relaxed text-ink-soft">{t.showcase.body}</p>
        </Reveal>
      </div>
      {/* mobile: swipeable shelf · desktop: staggered gallery */}
      <ul className="mt-14 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-10 [scrollbar-width:none] sm:px-8 lg:mx-auto lg:grid lg:max-w-7xl lg:grid-cols-3 lg:gap-x-10 lg:gap-y-16 lg:overflow-visible">
        {WORLDS.map((w, i) => (
          <li key={w} className={`w-[72vw] max-w-[320px] shrink-0 snap-center lg:w-auto lg:max-w-none ${i % 3 === 1 ? 'lg:translate-y-12' : ''}`}>
            <Link href={`/create?world=${w}`} className="group block rounded-2xl">
              <BookCover title={t.catalog.worlds[w].name} name="" world={w} eyebrow="Hikaya" dir={locale === 'ar' ? 'rtl' : 'ltr'} angle={18} />
              <div className="mt-8 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl">{t.catalog.worlds[w].name}</h3>
                  <p className="mt-1 text-ink-muted">{t.catalog.worlds[w].tagline}</p>
                </div>
                <span className="mt-1 grid size-10 shrink-0 place-items-center rounded-full bg-ink/5 transition-colors group-hover:bg-ink group-hover:text-ivory">
                  <ArrowRight className="size-4 rtl:-scale-x-100" />
                  <span className="sr-only">{t.showcase.explore}</span>
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mx-auto max-w-7xl px-4 text-sm text-ink-muted italic sm:px-8 lg:mt-10">{t.showcase.artNote}</p>
    </section>
  );
}

export function Production({ t }: P) {
  const icons = [BookOpen, Feather, Printer, Package];
  return (
    <section className="relative bg-paper py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-8">
        <Reveal className="text-center">
          <div className="flex justify-center">
            <Eyebrow>{t.production.eyebrow}</Eyebrow>
          </div>
          <h2 className="font-display mt-5 text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl">{t.production.title}</h2>
        </Reveal>
        <ol className="relative mt-14 space-y-10 before:absolute before:inset-y-2 before:start-6 before:w-px before:bg-gold/60 sm:mt-16">
          {t.production.items.map((item, i) => {
            const Icon = icons[i];
            return (
              <Reveal key={i} delay={0.08 * i}>
                <li className="relative flex gap-6">
                  <span className="relative z-10 grid size-12 shrink-0 place-items-center rounded-full bg-ivory text-gold-deep shadow-[var(--shadow-soft)] ring-1 ring-gold/40">
                    <Icon className="size-5" />
                  </span>
                  <div className="pt-1">
                    <h3 className="font-display text-2xl">{item.title}</h3>
                    <p className="mt-2 max-w-xl text-lg leading-relaxed text-ink-soft">{item.body}</p>
                  </div>
                </li>
              </Reveal>
            );
          })}
        </ol>
        <p className="mt-14 rounded-2xl bg-lavender/50 px-6 py-4 text-center text-ink-soft">{t.production.note}</p>
      </div>
    </section>
  );
}

export function FinalCta({ t }: P) {
  return (
    <section className="px-4 py-20 sm:px-8 sm:py-28">
      <Reveal>
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-night px-6 py-16 text-center text-ivory sm:px-12 sm:py-24">
          <WorldScene world="space" moment="triumph" characters={false} className="absolute inset-0 size-full opacity-70" />
          <div className="absolute inset-0 bg-[radial-gradient(closest-side,rgb(20_26_46/0.2),rgb(20_26_46/0.75))]" />
          <div className="relative">
            <h2 className="font-display mx-auto max-w-3xl text-4xl leading-[1.05] tracking-[-0.02em] text-balance sm:text-6xl">{t.finalCta.title}</h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-ivory/80">{t.finalCta.body}</p>
            <Link href="/create" className={buttonClass('gold', 'lg', 'mt-10')}>
              {t.finalCta.cta}
              <ArrowRight className="size-5 rtl:-scale-x-100" />
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
