'use client';

import { Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useI18n } from '@/i18n/client';

import { buttonClass } from './button';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './Logo';

export function Header() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const links = [
    { href: '/#comment', label: t.nav.how },
    { href: '/#histoires', label: t.nav.stories },
    { href: '/#apprendre', label: t.nav.learn },
  ];

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-300 ${
        scrolled ? 'bg-ivory/85 shadow-[0_1px_0_rgb(32_38_61/0.08)] backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-8" aria-label="Principal">
        <Link href="/" className="rounded-lg" aria-label={t.nav.home}>
          <Logo locale={locale} />
        </Link>
        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="rounded-full px-4 py-2 text-[0.95rem] text-ink-soft transition-colors hover:text-ink">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher className="max-sm:hidden" />
          <Link href="/create" className={buttonClass('primary', 'md', 'max-sm:hidden')}>
            {t.nav.create}
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full text-ink hover:bg-ink/5 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t.nav.close : t.nav.menu}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="paper fixed inset-x-0 top-16 bottom-0 z-40 flex flex-col px-6 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:top-20 lg:hidden"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <ul className="flex flex-col">
              {links.map((l, i) => (
                <motion.li key={l.href} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
                  <Link href={l.href} onClick={() => setOpen(false)} className="font-display block border-b border-ink/10 py-5 text-3xl">
                    {l.label}
                  </Link>
                </motion.li>
              ))}
            </ul>
            <div className="mt-auto flex flex-col gap-5">
              <LanguageSwitcher className="self-start" />
              <Link href="/create" onClick={() => setOpen(false)} className={buttonClass('primary', 'lg', 'w-full')}>
                {t.nav.create}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
