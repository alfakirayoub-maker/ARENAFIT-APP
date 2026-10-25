import { useTranslation } from 'react-i18next';

import { DetailScreen } from '@/components/ui/DetailScreen';
import { EmptyState } from '@/components/ui/EmptyState';

/**
 * Placeholder. The member activation / sign-in flow (phone-based, imported
 * members) is decided before Sprint 3 — nothing is faked here.
 */
export default function LoginScreen() {
  const { t } = useTranslation();
  return (
    <DetailScreen>
      <EmptyState icon="log-in-outline" title={t('login.title')} body={t('login.body')} />
    </DetailScreen>
  );
}
