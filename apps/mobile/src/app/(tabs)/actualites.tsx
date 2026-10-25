import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

// Sprint 1 shell — news feed and article detail in Sprint 2.
export default function NewsScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <ScreenHeader title={t('news.title')} subtitle={t('news.subtitle')} />
      <EmptyState icon="newspaper-outline" title={t('empty.noNews.title')} body={t('empty.noNews.body')} />
    </Screen>
  );
}
