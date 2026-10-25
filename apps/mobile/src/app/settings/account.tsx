import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';

import { DetailScreen } from '@/components/ui/DetailScreen';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { Text } from '@/components/ui/Text';

/**
 * Account settings. Language is fixed to French until the Arabic/English
 * translations are reviewed (RTL QA needed for Arabic).
 */
export default function AccountSettingsScreen() {
  const { t } = useTranslation();

  return (
    <DetailScreen>
      <Text variant="display" accessibilityRole="header">
        {t('account.title')}
      </Text>
      <ListGroup>
        <ListRow icon="language-outline" label={t('account.language')} value={t('account.languageValue')} />
        <ListRow icon="information-circle-outline" label={t('account.version')} value={Constants.expoConfig?.version ?? '—'} />
      </ListGroup>
    </DetailScreen>
  );
}
