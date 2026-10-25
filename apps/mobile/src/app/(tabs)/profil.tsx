import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

// Sprint 1 shell — membership card, preferences and Pass & Invitations later.
export default function ProfileScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <ScreenHeader title={t('profile.title')} />
      <EmptyState icon="person-outline" title={t('empty.comingSoon.title')} body={t('empty.comingSoon.body')} />
      {__DEV__ && (
        <Button label="UI kit (dev)" variant="ghost" icon="color-palette-outline" onPress={() => router.push('/dev/ui')} />
      )}
    </Screen>
  );
}
