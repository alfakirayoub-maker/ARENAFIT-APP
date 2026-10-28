import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/dm-sans/index.css';
import '@fontsource-variable/noto-naskh-arabic/index.css';
import '@fontsource/amiri/700.css';
import './globals.css';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { dirOf } from '@/i18n';
import { I18nProvider } from '@/i18n/client';
import { getMessages } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getMessages();
  return {
    title: { default: t.meta.title, template: `%s · Hikaya` },
    description: t.meta.description,
    openGraph: { title: t.meta.title, description: t.meta.description, locale, type: 'website' },
  };
}

export const viewport: Viewport = {
  themeColor: '#faf7f0',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale } = await getMessages();
  return (
    <html lang={locale} dir={dirOf(locale)} suppressHydrationWarning>
      <head>
        {/* Marks JS as available before paint so scroll reveals never hide content without it. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="paper text-ink antialiased">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
