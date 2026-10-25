import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';

export default function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <EmptyState
        icon="compass-outline"
        title={t('errors.notFound')}
        actionLabel={t('tabs.home')}
        onAction={() => router.replace('/')}
      />
    </Screen>
  );
}
