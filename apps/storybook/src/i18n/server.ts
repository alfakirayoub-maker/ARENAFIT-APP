import 'server-only';

import { cookies } from 'next/headers';

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, MESSAGES } from '.';

/** Interface language: the visitor's saved choice, French otherwise. */
export async function getLocale() {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getMessages() {
  const locale = await getLocale();
  return { locale, t: MESSAGES[locale] };
}
