import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { DetailScreen } from '@/components/ui/DetailScreen';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { Text } from '@/components/ui/Text';
import { useNotificationPreferences } from '@/features/settings/notification-preferences';
import { spacing } from '@/theme';

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const { prefs, set } = useNotificationPreferences();

  return (
    <DetailScreen>
      <Text variant="display" accessibilityRole="header">
        {t('notificationSettings.title')}
      </Text>
      <ListGroup>
        <ListRow
          icon="alarm-outline"
          label={t('notificationSettings.classReminders')}
          hint={t('notificationSettings.classRemindersHint')}
          toggle={{ value: prefs.classReminders, onChange: (v) => set('classReminders', v) }}
        />
        <ListRow
          icon="calendar-outline"
          label={t('notificationSettings.scheduleChanges')}
          toggle={{ value: prefs.scheduleChanges, onChange: (v) => set('scheduleChanges', v) }}
        />
        <ListRow
          icon="newspaper-outline"
          label={t('notificationSettings.clubNews')}
          toggle={{ value: prefs.clubNews, onChange: (v) => set('clubNews', v) }}
        />
        <ListRow
          icon="sparkles-outline"
          label={t('notificationSettings.events')}
          toggle={{ value: prefs.events, onChange: (v) => set('events', v) }}
        />
      </ListGroup>
      <Text variant="caption" color="tertiary" style={styles.note}>
        {t('notificationSettings.deviceOnly')}
      </Text>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: -spacing.md },
});
