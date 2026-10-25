import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Artwork } from '@/components/brand/Artwork';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DetailScreen } from '@/components/ui/DetailScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { InfoGrid, InfoTile } from '@/components/ui/InfoTile';
import { IntensityMeter } from '@/components/ui/IntensityMeter';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useActivity, useClassSession } from '@/data/queries';
import { hasEnded, hasStarted, relativeDayLabel } from '@/features/planning/session-utils';
import { useReminderOffsetLabel, useReminderSheet } from '@/features/reminders/ReminderSheet';
import { useReminders } from '@/features/reminders/store';
import { durationMinutes } from '@/lib/club-time';
import { colors, radius, spacing } from '@/theme';

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const sessionQuery = useClassSession(id);
  const session = sessionQuery.data;
  const activityQuery = useActivity(session?.activity.slug ?? '');
  const activity = session ? activityQuery.data : undefined;

  const reminders = useReminders();
  const reminderSheet = useReminderSheet();
  const offsetLabel = useReminderOffsetLabel();

  if (sessionQuery.data === undefined && sessionQuery.isError) {
    return (
      <DetailScreen>
        <ErrorState onRetry={() => sessionQuery.refetch()} />
      </DetailScreen>
    );
  }
  if (sessionQuery.data === undefined) {
    return (
      <DetailScreen hero={<Skeleton height="100%" borderRadius={0} />}>
        <Skeleton width="50%" height={36} />
        <Skeleton height={140} borderRadius={radius.lg} />
        <Skeleton height={80} borderRadius={radius.lg} />
      </DetailScreen>
    );
  }
  if (!session) {
    return (
      <DetailScreen>
        <EmptyState icon="calendar-clear-outline" title={t('classDetail.notFound')} />
      </DetailScreen>
    );
  }

  const reminder = reminders.offsetFor(session.id);
  const started = hasStarted(session);
  const description = session.description ?? activity?.description ?? null;
  const hasDetails =
    activity &&
    (activity.intensity !== null ||
      activity.equipment.length > 0 ||
      activity.targetMuscles.length > 0 ||
      activity.recommendedFor !== null);

  const footer =
    started || session.isCancelled ? null : (
      <>
        <Button
          label={reminder !== undefined ? t('reminder.activeLabel', { offset: offsetLabel(reminder) }) : t('reminder.cta')}
          icon={reminder !== undefined ? 'notifications' : 'notifications-outline'}
          variant={reminder !== undefined ? 'secondary' : 'primary'}
          size="lg"
          fullWidth
          onPress={() => reminderSheet.open(session)}
        />
        <Text variant="caption" color="tertiary" align="center">
          {t('classDetail.notAReservation')}
        </Text>
      </>
    );

  return (
    <DetailScreen
      hero={<Artwork imageUrl={session.activity.imageUrl} category={session.activity.category} iconSize={320} style={styles.hero} />}
      footer={footer}>
      {/* Title block */}
      <View style={styles.titleBlock}>
        <View style={styles.badges}>
          <Badge label={t(`categories.${session.activity.category}`)} tone="accent" />
          {session.isCancelled && <Badge label={t('classDetail.cancelled')} tone="error" />}
          {started && !session.isCancelled && (
            <Badge label={hasEnded(session) ? t('planning.finished') : t('planning.inProgress')} />
          )}
        </View>
        <Text variant="display" accessibilityRole="header">
          {session.activity.name}
        </Text>
        <View style={styles.when}>
          <Icon name="time-outline" size={20} color={colors.primary} />
          <Text variant="heading">
            {session.startTime} – {session.endTime}
          </Text>
        </View>
        <Text variant="body" color="secondary">
          {relativeDayLabel(session.date)}
        </Text>
      </View>

      {/* Key facts */}
      <InfoGrid>
        <InfoTile icon="person-outline" label={t('classDetail.coach')} value={session.coach?.displayName ?? t('common.unknown')} />
        <InfoTile
          icon="hourglass-outline"
          label={t('classDetail.duration')}
          value={t('common.minutes', { count: durationMinutes(session.startTime, session.endTime) })}
        />
        <InfoTile icon="stats-chart-outline" label={t('classDetail.level')} value={t(`levels.${session.level}`)} />
        <InfoTile icon="location-outline" label={t('classDetail.room')} value={session.room ?? t('common.unknown')} />
      </InfoGrid>

      {/* Description */}
      <View style={styles.block}>
        <Text variant="heading" accessibilityRole="header">
          {t('classDetail.about')}
        </Text>
        <Text variant="body" color={description ? 'secondary' : 'tertiary'}>
          {description ?? t('classDetail.noDescription')}
        </Text>
      </View>

      {/* Optional details — only what is actually known */}
      {hasDetails && activity && (
        <View style={styles.block}>
          <Text variant="heading" accessibilityRole="header">
            {t('classDetail.details')}
          </Text>
          <View style={styles.detailCard}>
            {activity.intensity !== null && (
              <DetailLine
                label={t('classDetail.intensity')}
                accessibilityValue={`${activity.intensity}/5`}
                value={<IntensityMeter value={activity.intensity} />}
              />
            )}
            {activity.equipment.length > 0 && (
              <DetailLine label={t('classDetail.equipment')} value={activity.equipment.join(', ')} />
            )}
            {activity.targetMuscles.length > 0 && (
              <DetailLine label={t('classDetail.targetMuscles')} value={activity.targetMuscles.join(', ')} />
            )}
            {activity.recommendedFor && <DetailLine label={t('classDetail.audience')} value={activity.recommendedFor} />}
          </View>
        </View>
      )}

      {/* Links */}
      <ListGroup>
        <ListRow
          icon="flash-outline"
          label={t('classDetail.seeActivity')}
          hint={session.activity.name}
          onPress={() => router.push({ pathname: '/activities/[slug]', params: { slug: session.activity.slug } })}
        />
        {session.coach && (
          <ListRow
            icon="person-outline"
            label={t('classDetail.seeCoach')}
            hint={session.coach.displayName}
            onPress={() => router.push({ pathname: '/coaches/[slug]', params: { slug: session.coach!.slug } })}
          />
        )}
      </ListGroup>
    </DetailScreen>
  );
}

function DetailLine({
  label,
  value,
  accessibilityValue,
}: {
  label: string;
  value: React.ReactNode;
  accessibilityValue?: string;
}) {
  return (
    <View
      style={styles.detailLine}
      accessible
      accessibilityLabel={`${label}: ${accessibilityValue ?? (typeof value === 'string' ? value : '')}`}>
      <Text variant="caption" color="tertiary" style={styles.detailLabel}>
        {label}
      </Text>
      {typeof value === 'string' ? (
        <Text variant="bodyStrong" style={styles.detailValue}>
          {value}
        </Text>
      ) : (
        <View style={styles.detailValue}>{value}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1 },
  titleBlock: { gap: spacing.xs },
  badges: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  when: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  block: { gap: spacing.md },
  detailCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.lg },
  detailLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  detailLabel: { width: 110 },
  detailValue: { flex: 1 },
});
