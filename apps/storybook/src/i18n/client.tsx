'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useTransition, type ReactNode } from 'react';

import type { Locale } from '@/lib/engine/types';

import { dirOf, LOCALE_COOKIE, MESSAGES, type Messages } from '.';

interface I18nValue {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  t: Messages;
  setLocale: (locale: Locale) => void;
  switching: boolean;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const router = useRouter();
  const [switching, startTransition] = useTransition();

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      // Update attributes immediately so the switch feels instant, then re-render server parts.
      document.documentElement.lang = next;
      document.documentElement.dir = dirOf(next);
      startTransition(() => router.refresh());
    },
    [router],
  );

  return (
    <I18nContext.Provider value={{ locale, dir: dirOf(locale), t: MESSAGES[locale], setLocale, switching }}>{children}</I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}
