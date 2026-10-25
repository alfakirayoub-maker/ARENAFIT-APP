import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { formatTime } from '@/lib/format';
import { colors, radius, spacing } from '@/theme';
import type { ClassSessionSummary } from '@/types/domain';

export type ClassCardProps = {
  session: ClassSessionSummary;
  onPress?: () => void;
  /** Reminder state — a reminder is never a reservation. */
  reminderSet?: boolean;
  onToggleReminder?: () => void;
};

/** Schedule row: time column, class info, level and reminder toggle. No booking. */
export function ClassCard({ session, onPress, reminderSet = false, onToggleReminder }: ClassCardProps) {
  const { t } = useTranslation();
  const start = formatTime(session.startsAt);
  const end = formatTime(session.endsAt);
  const meta = [session.coachName && `Coach ${session.coachName}`, session.roomName].filter(Boolean).join(' · ');

  return (
    <View style={[styles.card, session.isCancelled && styles.cancelled]}>
      {/* The reminder toggle is a sibling, not a child, of the pressable area so
          both stay separately focusable for screen readers. */}
      <PressableScale
        onPress={onPress}
        disabled={!onPress}
        scaleTo={0.98}
        accessibilityLabel={`${session.activityName}, ${start} – ${end}${meta ? `, ${meta}` : ''}`}
        style={styles.main}>
        <View style={styles.timeCol}>
          <Text variant="subheading">{start}</Text>
          <Text variant="caption" color="tertiary">
            {end}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.body}>
          <Text variant="subheading" numberOfLines={1}>
            {session.activityName}
          </Text>
          {meta.length > 0 && (
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {meta}
            </Text>
          )}
          <Badge label={t(`levels.${session.level}`)} />
        </View>

        {session.imageUrl && (
          <Image source={session.imageUrl} style={styles.thumb} contentFit="cover" transition={200} accessible={false} />
        )}
      </PressableScale>

      {onToggleReminder && (
        <IconButton
          icon={reminderSet ? 'notifications' : 'notifications-outline'}
          accessibilityLabel={reminderSet ? t('reminder.set') : t('reminder.cta')}
          active={reminderSet}
          onPress={onToggleReminder}
          size={40}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  cancelled: { opacity: 0.5 },
  timeCol: { width: 52, gap: spacing.xxs },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },
  body: { flex: 1, gap: spacing.xs },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
});
