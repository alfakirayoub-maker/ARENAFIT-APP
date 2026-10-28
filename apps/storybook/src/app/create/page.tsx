import type { Metadata } from 'next';
import { Suspense } from 'react';

import { Studio } from '@/components/studio/Studio';
import { getMessages } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.studio.title };
}

export default function CreatePage() {
  return (
    <Suspense>
      <Studio />
    </Suspense>
  );
}
