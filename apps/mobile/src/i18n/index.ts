import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ar from './locales/ar';
import en from './locales/en';
import fr from './locales/fr';

export const supportedLocales = ['fr', 'ar', 'en'] as const;
export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = 'fr';

export const resources = {
  fr: { translation: fr },
  en: { translation: en },
  ar: { translation: ar },
} as const;

export function isRTL(locale: Locale): boolean {
  return locale === 'ar';
}

/**
 * French is the product language. The device locale is only honored when it is
 * one we ship; anything else falls back to French.
 */
export function resolveDeviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode;
  return supportedLocales.find((l) => l === code) ?? defaultLocale;
}

i18n.use(initReactI18next).init({
  resources,
  // MVP ships in French; switch to resolveDeviceLocale() once ar/en are reviewed
  // and RTL layouts are QA'd.
  lng: defaultLocale,
  fallbackLng: defaultLocale,
  supportedLngs: supportedLocales,
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
});

export default i18n;
