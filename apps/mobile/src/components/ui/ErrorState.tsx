import { useTranslation } from 'react-i18next';

import { EmptyState } from './EmptyState';

/** Load failure with a retry action. */
export function ErrorState({ onRetry, compact }: { onRetry: () => void; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      compact={compact}
      icon="cloud-offline-outline"
      title={t('errors.loadFailed')}
      actionLabel={t('common.retry')}
      onAction={onRetry}
    />
  );
}
