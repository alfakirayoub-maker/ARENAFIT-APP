import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { categoryIcons } from '@/components/brand/Artwork';
import { SessionList } from '@/components/planning/SessionList';
import { Avatar } from '@/components/ui/Avatar';
import { DetailScreen } from '@/components/ui/DetailScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { ClassCardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useActivitiesForCoach, useCoach, useUpcomingSessions } from '@/data/queries';
import { radius, spacing } from '@/theme';

const UPCOMING_LIMIT = 5;

export default function CoachDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const coachQuery = useCoach(slug);
  const coach = coachQuery.data;
  const classesQuery = useActivitiesForCoach(coach?.id);
  const upcomingQuery = useUpcomingSessions({ coachId: coach?.id, limit: UPCOMING_LIMIT }, { enabled: !!coach });

  if (coachQuery.data === undefined && coachQuery.isError) {
    return (
      <DetailScreen>
        <ErrorState onRetry={() => coachQuery.refetch()} />
      </DetailScreen>
    );
  }
  if (coachQuery.data === undefined) {
    return (
      <DetailScreen>
        <Skeleton width={112} height={112} borderRadius={radius.pill} />
        <Skeleton width="50%" height={32} />
      </DetailScreen>
    );
  }
  if (!coach) {
    return (
      <DetailScreen>
        <EmptyState icon="person-outline" title={t('coach.notFound')} />
      </DetailScreen>
    );
  }

  const classes = classesQuery.data ?? [];
  const upcoming = upcomingQuery.data ?? [];

  return (
    <DetailScreen>
      <View style={styles.header}>
        <Avatar name={coach.displayName} imageUrl={coach.photoUrl} size={112} highlighted />
        <Text variant="overline" color="accent" uppercase>
          Coach
        </Text>
        <Text variant="display" accessibilityRole="header" align="center">
          {coach.displayName}
        </Text>
        <Text variant="body" color="secondary" align="center">
          {coach.bio ?? t('coach.noBio')}
        </Text>
      </View>

      <View style={styles.block}>
        <Text variant="heading" accessibilityRole="header">
          {t('coach.classes')}
        </Text>
        {classesQuery.data === undefined && <Skeleton height={112} borderRadius={radius.xl} />}
        <ListGroup>
          {classes.map((a) => (
            <ListRow
              key={a.id}
              icon={categoryIcons[a.category]}
              label={a.name}
              hint={t(`categories.${a.category}`)}
              onPress={() => router.push({ pathname: '/activities/[slug]', params: { slug: a.slug } })}
            />
          ))}
        </ListGroup>
      </View>

      <View style={styles.block}>
        <Text variant="heading" accessibilityRole="header">
          {t('coach.upcoming')}
        </Text>
        {upcomingQuery.data === undefined ? (
          upcomingQuery.isError ? <ErrorState compact onRetry={() => upcomingQuery.refetch()} /> : <ClassCardSkeleton />
        ) : upcoming.length > 0 ? (
          <SessionList sessions={upcoming} />
        ) : (
          <EmptyState compact icon="calendar-clear-outline" title={t('activities.noSessionsThisWeek')} />
        )}
      </View>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.sm },
  block: { gap: spacing.md },
});
