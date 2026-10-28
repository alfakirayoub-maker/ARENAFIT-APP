import type { Metadata } from 'next';

import { BookViewer } from '@/components/book/BookViewer';
import { getMessages } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.book.title, robots: { index: false } };
}

export default function PreviewPage() {
  return <BookViewer />;
}
