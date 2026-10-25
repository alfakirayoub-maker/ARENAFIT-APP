import { useTranslation } from 'react-i18next';

import { Logo } from '@/components/brand/Logo';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

// Sprint 1 shell — the Home UI (next class, today's schedule, guest pass card,
// favorites) is built in Sprint 2.
export default function HomeScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <ScreenHeader eyebrow={<Logo height={24} />} title={t('home.greetingAnonymous')} />
      <EmptyState icon="sparkles-outline" title={t('empty.comingSoon.title')} body={t('empty.comingSoon.body')} />
    </Screen>
  );
}
