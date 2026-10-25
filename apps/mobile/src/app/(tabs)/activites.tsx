import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

// Sprint 1 shell — categories, featured activities and coaches in Sprint 2.
export default function ActivitiesScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <ScreenHeader title={t('activities.title')} subtitle={t('activities.subtitle')} />
      <EmptyState icon="flash-outline" title={t('empty.comingSoon.title')} body={t('empty.comingSoon.body')} />
    </Screen>
  );
}
