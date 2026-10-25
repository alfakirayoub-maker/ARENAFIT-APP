import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Artwork } from '@/components/brand/Artwork';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { coachLabel, relativeDayLabel } from '@/features/planning/session-utils';
import { useReminderOffsetLabel, useReminderSheet } from '@/features/reminders/ReminderSheet';
import { useReminders } from '@/features/reminders/store';
import { colors, radius, spacing } from '@/theme';
import type { ClassSession } from '@/types/domain';

/** Home hero: the next class, with the reminder CTA. */
export function NextClassCard({ session }: { session: ClassSession }) {
  const { t } = useTranslation();
  const reminders = useReminders();
  const reminderSheet = useReminderSheet();
  const offsetLabel = useReminderOffsetLabel();
  const reminder = reminders.offsetFor(session.id);
  const meta = [coachLabel(session), session.room].filter(Boolean);

  return (
    <View style={styles.card}>
      <PressableScale
        onPress={() => router.push({ pathname: '/classes/[id]', params: { id: session.id } })}
        scaleTo={0.99}
        accessibilityLabel={`${session.activity.name}, ${relativeDayLabel(session.date)}, ${session.startTime} – ${session.endTime}`}>
        <Artwork imageUrl={session.activity.imageUrl} category={session.activity.category} iconSize={200} style={styles.art} />
        <View style={styles.body}>
          <View style={styles.dayRow}>
            <Badge label={relativeDayLabel(session.date)} tone="accent" />
            <Badge label={t(`levels.${session.level}`)} />
          </View>
          <Text variant="display" numberOfLines={1}>
            {session.activity.name}
          </Text>
          <View style={styles.timeRow}>
            <Icon name="time-outline" size={18} color={colors.primary} />
            <Text variant="subheading">
              {session.startTime} – {session.endTime}
            </Text>
          </View>
          {meta.map((line) => (
            <Text key={line} variant="body" color="secondary" numberOfLines={1}>
              {line}
            </Text>
          ))}
        </View>
      </PressableScale>
      <View style={styles.footer}>
        <Button
          label={reminder !== undefined ? t('reminder.activeLabel', { offset: offsetLabel(reminder) }) : t('reminder.cta')}
          icon={reminder !== undefined ? 'notifications' : 'notifications-outline'}
          variant={reminder !== undefined ? 'secondary' : 'primary'}
          size="lg"
          fullWidth
          onPress={() => reminderSheet.open(session)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, backgroundColor: colors.surface, overflow: 'hidden' },
  art: { height: 132 },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.xs },
  dayRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxs },
  footer: { padding: spacing.xl, paddingTop: spacing.lg },
});
