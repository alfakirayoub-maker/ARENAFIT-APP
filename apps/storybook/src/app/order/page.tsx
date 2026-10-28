import type { Metadata } from 'next';

import { OrderFlow } from '@/components/order/OrderFlow';
import { getMessages } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.order.title, robots: { index: false } };
}

export default function OrderPage() {
  return <OrderFlow />;
}
