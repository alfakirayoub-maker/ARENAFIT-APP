import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { coachLabel, hasEnded, hasStarted } from '@/features/planning/session-utils';
import { useReminderOffsetLabel, useReminderSheet } from '@/features/reminders/ReminderSheet';
import { useReminders } from '@/features/reminders/store';
import { colors, radius, spacing } from '@/theme';
import type { ClassSession } from '@/types/domain';

export type ClassCardProps = {
  session: ClassSession;
};

/**
 * Schedule row: time column, class info, level and reminder bell. Opens the
 * class detail. No booking — the bell sets a reminder only.
 */
export function ClassCard({ session }: ClassCardProps) {
  const { t } = useTranslation();
  const reminders = useReminders();
  const reminderSheet = useReminderSheet();
  const offsetLabel = useReminderOffsetLabel();

  const started = hasStarted(session);
  const reminder = reminders.offsetFor(session.id);
  const meta = [coachLabel(session), session.room].filter(Boolean).join(' · ');
  const inactive = started || session.isCancelled;

  return (
    <View style={[styles.card, inactive && styles.inactive]}>
      {/* The bell is a sibling of the pressable area so both stay separately
          focusable for screen readers. */}
      <PressableScale
        onPress={() => router.push({ pathname: '/classes/[id]', params: { id: session.id } })}
        scaleTo={0.98}
        accessibilityLabel={`${session.activity.name}, ${session.startTime} – ${session.endTime}${meta ? `, ${meta}` : ''}`}
        style={styles.main}>
        <View style={styles.timeCol}>
          <Text variant="subheading">{session.startTime}</Text>
          <Text variant="caption" color="tertiary">
            {session.endTime}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.body}>
          <Text variant="subheading" numberOfLines={1}>
            {session.activity.name}
          </Text>
          {meta.length > 0 && (
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {meta}
            </Text>
          )}
          <View style={styles.badges}>
            {session.isCancelled ? (
              <Badge label={t('classDetail.cancelled')} tone="error" />
            ) : started ? (
              <Badge label={hasEnded(session) ? t('planning.finished') : t('planning.inProgress')} />
            ) : (
              <Badge label={t(`levels.${session.level}`)} />
            )}
            {reminder !== undefined && !inactive && (
              <Badge
                label={t('reminder.activeLabel', { offset: offsetLabel(reminder) })}
                tone="accent"
                icon="notifications"
              />
            )}
          </View>
        </View>
      </PressableScale>

      {!inactive && (
        <View style={styles.bell}>
          <IconButton
            icon={reminder !== undefined ? 'notifications' : 'notifications-outline'}
            accessibilityLabel={reminder !== undefined ? t('reminder.set') : t('reminder.cta')}
            active={reminder !== undefined}
            onPress={() => reminderSheet.open(session)}
            size={40}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  inactive: { opacity: 0.55 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  timeCol: { width: 52, gap: spacing.xxs },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },
  body: { flex: 1, gap: spacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  bell: { paddingRight: spacing.lg },
});
