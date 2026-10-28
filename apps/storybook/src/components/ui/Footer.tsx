import Link from 'next/link';

import type { Messages } from '@/i18n';
import type { Locale } from '@/lib/engine/types';

import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './Logo';

export function Footer({ t, locale }: { t: Messages; locale: Locale }) {
  return (
    <footer className="border-t border-ink/10 px-4 pt-14 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-sm">
          <Logo locale={locale} />
          <p className="mt-4 text-ink-soft">{t.footer.tagline}</p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-3 text-ink-soft sm:flex-row sm:gap-8">
          <Link href="/#comment" className="hover:text-ink">
            {t.nav.how}
          </Link>
          <Link href="/#histoires" className="hover:text-ink">
            {t.nav.stories}
          </Link>
          <Link href="/#apprendre" className="hover:text-ink">
            {t.nav.learn}
          </Link>
          <Link href="/create" className="font-medium text-ink hover:underline">
            {t.nav.create}
          </Link>
        </nav>
        <LanguageSwitcher className="self-start" />
      </div>
      <div className="mx-auto mt-12 flex max-w-7xl flex-col gap-2 border-t border-ink/10 pt-6 text-sm text-ink-muted sm:flex-row sm:justify-between">
        <p>{t.footer.demo}</p>
        <p>
          © {new Date().getFullYear()} Hikaya. {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
