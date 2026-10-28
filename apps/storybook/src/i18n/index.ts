import { LOCALES, type Locale } from '@/lib/engine/types';
import { deepTypeset, typesetFrench } from '@/lib/typeset';

import { ar } from './ar';
import { en } from './en';
import { fr, type Messages } from './fr';

export const MESSAGES: Record<Locale, Messages> = { fr: deepTypeset(fr, typesetFrench), en, ar };
export const DEFAULT_LOCALE: Locale = 'fr';
export const LOCALE_COOKIE = 'hikaya-locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export const dirOf = (locale: Locale) => (locale === 'ar' ? 'rtl' : 'ltr');

export type { Messages };
