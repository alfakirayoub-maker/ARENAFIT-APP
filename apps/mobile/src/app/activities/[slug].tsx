import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Artwork } from '@/components/brand/Artwork';
import { CoachCard } from '@/components/cards/CoachCard';
import { SessionList } from '@/components/planning/SessionList';
import { Badge } from '@/components/ui/Badge';
import { DetailScreen } from '@/components/ui/DetailScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconButton } from '@/components/ui/IconButton';
import { InfoGrid, InfoTile } from '@/components/ui/InfoTile';
import { ClassCardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useActivity, useCoachesForActivity, useUpcomingSessions } from '@/data/queries';
import { useFavoriteActivities } from '@/features/favorites/store';
import { screenGutter, spacing } from '@/theme';

const UPCOMING_LIMIT = 4;

export default function ActivityDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const activityQuery = useActivity(slug);
  const activity = activityQuery.data;
  const coachesQuery = useCoachesForActivity(activity?.id);
  const upcomingQuery = useUpcomingSessions({ activityId: activity?.id, limit: UPCOMING_LIMIT }, { enabled: !!activity });
  const favorites = useFavoriteActivities();

  if (activityQuery.data === undefined && activityQuery.isError) {
    return (
      <DetailScreen>
        <ErrorState onRetry={() => activityQuery.refetch()} />
      </DetailScreen>
    );
  }
  if (activityQuery.data === undefined) {
    return (
      <DetailScreen hero={<Skeleton height="100%" borderRadius={0} />}>
        <Skeleton width="60%" height={36} />
        <Skeleton height={90} />
      </DetailScreen>
    );
  }
  if (!activity) {
    return (
      <DetailScreen>
        <EmptyState icon="flash-outline" title={t('activities.notFound')} />
      </DetailScreen>
    );
  }

  const isFavorite = favorites.isFavorite(activity.slug);
  const coaches = coachesQuery.data ?? [];
  const upcoming = upcomingQuery.data ?? [];

  return (
    <DetailScreen
      hero={<Artwork imageUrl={activity.imageUrl} category={activity.category} iconSize={320} style={styles.hero} />}
      headerRight={
        <IconButton
          icon={isFavorite ? 'heart' : 'heart-outline'}
          active={isFavorite}
          accessibilityLabel={isFavorite ? t('activities.removeFavorite') : t('activities.addFavorite')}
          onPress={() => favorites.toggle(activity.slug)}
        />
      }>
      <View style={styles.titleBlock}>
        <Badge label={t(`categories.${activity.category}`)} tone="accent" />
        <Text variant="display" accessibilityRole="header">
          {activity.name}
        </Text>
        {activity.shortDescription && (
          <Text variant="body" color="secondary">
            {activity.shortDescription}
          </Text>
        )}
      </View>

      {(activity.durationMin !== null || activity.intensity !== null) && (
        <InfoGrid>
          {activity.durationMin !== null && (
            <InfoTile icon="hourglass-outline" label={t('classDetail.duration')} value={t('common.minutes', { count: activity.durationMin })} />
          )}
          {activity.intensity !== null && (
            <InfoTile icon="flame-outline" label={t('classDetail.intensity')} value={`${activity.intensity}/5`} />
          )}
        </InfoGrid>
      )}

      <View style={styles.block}>
        <Text variant="heading" accessibilityRole="header">
          {t('classDetail.about')}
        </Text>
        <Text variant="body" color={activity.description ? 'secondary' : 'tertiary'}>
          {activity.description ?? t('classDetail.noDescription')}
        </Text>
      </View>

      {coaches.length > 0 && (
        <View style={styles.block}>
          <Text variant="heading" accessibilityRole="header">
            {t('activities.taughtBy')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bleed}
            contentContainerStyle={styles.rail}>
            {coaches.map((c) => (
              <CoachCard key={c.id} coach={c} />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.block}>
        <Text variant="heading" accessibilityRole="header">
          {t('activities.upcoming')}
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
  hero: { flex: 1 },
  titleBlock: { gap: spacing.sm },
  block: { gap: spacing.md },
  bleed: { marginHorizontal: -screenGutter },
  rail: { paddingHorizontal: screenGutter, gap: spacing.sm },
});
