import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DetailScreen } from '@/components/ui/DetailScreen';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { useClassReminderPreference, useNotificationPermission } from '@/features/reminders/hooks';
import { reminderService } from '@/features/reminders';
import type { PermissionState } from '@/features/reminders/types';
import { useNotificationPreferences } from '@/features/settings/notification-preferences';
import { spacing } from '@/theme';

const permissionTone: Record<PermissionState, 'success' | 'neutral' | 'error' | 'warning'> = {
  granted: 'success',
  undetermined: 'neutral',
  denied: 'error',
  unavailable: 'warning',
};

const permissionKey = {
  granted: 'notificationSettings.permissionGranted',
  undetermined: 'notificationSettings.permissionUndetermined',
  denied: 'notificationSettings.permissionDenied',
  unavailable: 'notificationSettings.permissionUnavailable',
} as const;

/**
 * Profil › Notifications.
 *  - "Cours & rappels" is real: it controls local class reminders.
 *  - The club categories are saved preferences for future remote push; the
 *    screen says plainly that nothing is sent yet.
 */
export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const { prefs, set } = useNotificationPreferences();
  const [classReminders, setClassReminders] = useClassReminderPreference();
  const { permission } = useNotificationPermission();

  return (
    <DetailScreen>
      <Text variant="display" accessibilityRole="header">
        {t('notificationSettings.title')}
      </Text>

      <View>
        <SectionHeader title={t('notificationSettings.sectionDevice')} />
        <ListGroup>
          <View style={styles.permissionRow}>
            <View style={styles.permissionText}>
              <Text variant="bodyStrong">{t('notificationSettings.systemPermission')}</Text>
              {permission && (
                <Badge
                  label={t(permissionKey[permission])}
                  tone={permissionTone[permission]}
                  icon={permission === 'granted' ? 'checkmark' : permission === 'denied' ? 'close' : undefined}
                />
              )}
            </View>
            {permission === 'denied' && (
              <Button
                label={t('notificationSettings.openSettings')}
                variant="secondary"
                onPress={() => void reminderService.openSettings()}
              />
            )}
          </View>
          <ListRow
            icon="alarm-outline"
            label={t('notificationSettings.classReminders')}
            hint={t('notificationSettings.classRemindersHint')}
            toggle={{ value: classReminders, onChange: setClassReminders }}
          />
        </ListGroup>
        {permission === 'denied' && (
          <Text variant="caption" color="tertiary" style={styles.footnote}>
            {t('reminder.deniedBody')}
          </Text>
        )}
        {permission === 'unavailable' || reminderService.kind === 'simulated' ? (
          <Text variant="caption" color="tertiary" style={styles.footnote}>
            {t('reminder.simulatedNote')}
          </Text>
        ) : null}
      </View>

      <View>
        <View style={styles.sectionTitle}>
          <SectionHeader title={t('notificationSettings.sectionClub')} />
          <Badge label={t('notificationSettings.soon')} tone="warning" />
        </View>
        <ListGroup>
          <ListRow
            icon="newspaper-outline"
            label={t('notificationSettings.news')}
            toggle={{ value: prefs.news, onChange: (v) => set('news', v) }}
          />
          <ListRow
            icon="pricetag-outline"
            label={t('notificationSettings.offersEvents')}
            toggle={{ value: prefs.offersEvents, onChange: (v) => set('offersEvents', v) }}
          />
          <ListRow
            icon="calendar-outline"
            label={t('notificationSettings.scheduleChanges')}
            toggle={{ value: prefs.scheduleChanges, onChange: (v) => set('scheduleChanges', v) }}
          />
        </ListGroup>
        <Text variant="caption" color="tertiary" style={styles.footnote}>
          {t('notificationSettings.clubFootnote')}
        </Text>
      </View>

      <Text variant="caption" color="tertiary">
        {t('notificationSettings.deviceOnly')}
      </Text>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  permissionText: { flex: 1, gap: spacing.xs },
  sectionTitle: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  footnote: { marginTop: spacing.sm },
});
