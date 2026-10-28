import Link from 'next/link';

import { getMessages } from '@/i18n/server';

export default async function NotFound() {
  const { t } = await getMessages();
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="font-display text-7xl text-gold-deep">404</p>
        <h1 className="font-display mt-4 text-3xl">{t.notFound.title}</h1>
        <p className="mt-3 text-ink-muted">{t.notFound.body}</p>
        <Link href="/" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-ink px-6 font-medium text-ivory">
          {t.notFound.cta}
        </Link>
      </div>
    </main>
  );
}
