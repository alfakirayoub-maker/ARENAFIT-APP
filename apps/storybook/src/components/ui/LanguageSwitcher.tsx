'use client';

import { useI18n } from '@/i18n/client';
import { LOCALES } from '@/lib/engine/types';

const SHORT = { fr: 'FR', en: 'EN', ar: 'ع' } as const;

export function LanguageSwitcher({ tone = 'light', className = '' }: { tone?: 'light' | 'dark'; className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div role="group" aria-label={t.nav.language} className={`inline-flex rounded-full p-1 ${tone === 'dark' ? 'bg-ivory/10' : 'bg-ink/[0.06]'} ${className}`}>
      {LOCALES.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={active}
            aria-label={t.languages[l]}
            onClick={() => !active && setLocale(l)}
            className={`min-h-9 min-w-10 rounded-full px-2.5 text-sm font-medium transition-colors ${
              active ? (tone === 'dark' ? 'bg-ivory text-ink' : 'bg-ink text-ivory') : tone === 'dark' ? 'text-ivory/80 hover:text-ivory' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {SHORT[l]}
          </button>
        );
      })}
    </div>
  );
}
