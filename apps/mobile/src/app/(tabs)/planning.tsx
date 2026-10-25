import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

// Sprint 1 shell — week selector, category filters and class list in Sprint 2.
export default function PlanningScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <ScreenHeader title={t('planning.title')} subtitle={t('planning.subtitle')} />
      <EmptyState icon="calendar-outline" title={t('empty.comingSoon.title')} body={t('empty.comingSoon.body')} />
    </Screen>
  );
}
