import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { CoachCard } from '@/components/cards/CoachCard';
import { MediaCard } from '@/components/cards/MediaCard';
import { ChipRow, type ChipOption } from '@/components/ui/ChipRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { MediaCardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { queryKeys, useActivities, useCoaches, useRefresh, useWeekSessions } from '@/data/queries';
import { clubNow, startOfWeek } from '@/lib/club-time';
import { colors, radius, screenGutter, spacing } from '@/theme';
import { activityCategories, type Activity, type ActivityCategory } from '@/types/domain';
import { categoryIcons } from '@/components/brand/Artwork';

type CategoryFilter = 'all' | ActivityCategory;

const openActivity = (a: Activity) => router.push({ pathname: '/activities/[slug]', params: { slug: a.slug } });

export default function ActivitiesScreen() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<CategoryFilter>('all');

  const activitiesQuery = useActivities();
  const coachesQuery = useCoaches();
  const monday = startOfWeek(clubNow().date);
  const weekQuery = useWeekSessions(monday);
  const refresh = useRefresh(queryKeys.activities, queryKeys.coaches, queryKeys.sessions);

  const activities = activitiesQuery.data ?? [];
  const sessionCounts = new Map<string, number>();
  for (const s of weekQuery.data ?? []) {
    sessionCounts.set(s.activity.id, (sessionCounts.get(s.activity.id) ?? 0) + 1);
  }
  const countLabel = (a: Activity) => {
    const n = sessionCounts.get(a.id) ?? 0;
    if (n === 0) return t('activities.noSessionsThisWeek');
    return n === 1 ? t('activities.oneSessionThisWeek') : t('activities.sessionsThisWeek', { count: n });
  };

  const featured = activities.filter((a) => a.isFeatured);
  const thisWeek = activities.filter((a) => sessionCounts.has(a.id));
  // "Popular" = most scheduled this week. A real popularity signal (favorites,
  // reminders) can replace this once data exists.
  const popular = [...thisWeek].sort((a, b) => (sessionCounts.get(b.id) ?? 0) - (sessionCounts.get(a.id) ?? 0)).slice(0, 4);
  const filtered = category === 'all' ? activities : activities.filter((a) => a.category === category);

  const categoryOptions: ChipOption<CategoryFilter>[] = [
    { value: 'all', label: t('categories.all') },
    ...activityCategories.map((c) => ({ value: c, label: t(`categories.${c}`) })),
  ];

  if (activitiesQuery.data === undefined && activitiesQuery.isError) {
    return (
      <Screen>
        <ScreenHeader title={t('activities.title')} subtitle={t('activities.subtitle')} />
        <ErrorState onRetry={() => activitiesQuery.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refresh.refreshing} onRefresh={refresh.onRefresh} tintColor={colors.primary} />
      }>
      <ScreenHeader title={t('activities.title')} subtitle={t('activities.subtitle')} />

      <SectionHeader title={t('activities.categories')} />
      <ChipRow options={categoryOptions} value={category} onChange={setCategory} />

      {activitiesQuery.data === undefined ? (
        <View style={styles.sectionTop}>
          <MediaCardSkeleton height={280} />
        </View>
      ) : category !== 'all' ? (
        <View style={styles.sectionTop}>
          {filtered.length > 0 ? (
            <ActivityGrid activities={filtered} countLabel={countLabel} />
          ) : (
            <EmptyState
              compact
              icon={categoryIcons[category]}
              title={t('activities.emptyCategory.title')}
              body={t('activities.emptyCategory.body')}
            />
          )}
        </View>
      ) : (
        <>
          {featured.length > 0 && (
            <View style={styles.sectionTop}>
              <SectionHeader title={t('activities.featured')} />
              <Rail>
                {featured.map((a) => (
                  <MediaCard
                    key={a.id}
                    title={a.name}
                    eyebrow={t(`categories.${a.category}`)}
                    subtitle={a.shortDescription ?? undefined}
                    imageUrl={a.imageUrl}
                    category={a.category}
                    width={260}
                    height={300}
                    onPress={() => openActivity(a)}
                  />
                ))}
              </Rail>
            </View>
          )}

          {thisWeek.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                title={t('activities.thisWeek')}
                actionLabel={t('common.seeAll')}
                onAction={() => router.push('/planning')}
              />
              <Rail>
                {thisWeek.map((a) => (
                  <MediaCard
                    key={a.id}
                    title={a.name}
                    eyebrow={t(`categories.${a.category}`)}
                    subtitle={countLabel(a)}
                    imageUrl={a.imageUrl}
                    category={a.category}
                    width={160}
                    height={180}
                    onPress={() => openActivity(a)}
                  />
                ))}
              </Rail>
            </View>
          )}

          {popular.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title={t('activities.popular')} />
              <ListGroup>
                {popular.map((a, i) => (
                  <ListRow
                    key={a.id}
                    icon={categoryIcons[a.category]}
                    label={`${i + 1}. ${a.name}`}
                    hint={countLabel(a)}
                    onPress={() => openActivity(a)}
                  />
                ))}
              </ListGroup>
              <Text variant="caption" color="tertiary" style={styles.hint}>
                {t('activities.popularHint')}
              </Text>
            </View>
          )}

          <View style={styles.section}>
            <SectionHeader title={t('activities.coaches')} />
            {coachesQuery.data === undefined ? (
              <View style={styles.coachSkeletons}>
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} width={72} height={72} borderRadius={radius.pill} />
                ))}
              </View>
            ) : (
              <Rail gap={spacing.sm}>
                {(coachesQuery.data ?? []).map((c) => (
                  <CoachCard key={c.id} coach={c} />
                ))}
              </Rail>
            )}
          </View>

          <View style={styles.section}>
            <SectionHeader title={t('activities.all')} />
            <ActivityGrid activities={activities} countLabel={countLabel} />
          </View>
        </>
      )}
    </Screen>
  );
}

function Rail({ children, gap = spacing.md }: { children: React.ReactNode; gap?: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bleed}
      contentContainerStyle={[styles.railContent, { gap }]}>
      {children}
    </ScrollView>
  );
}

function ActivityGrid({ activities, countLabel }: { activities: Activity[]; countLabel: (a: Activity) => string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.grid}>
      {activities.map((a) => (
        <MediaCard
          key={a.id}
          title={a.name}
          eyebrow={t(`categories.${a.category}`)}
          subtitle={countLabel(a)}
          imageUrl={a.imageUrl}
          category={a.category}
          height={170}
          style={styles.gridItem}
          onPress={() => openActivity(a)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTop: { marginTop: spacing.xxl },
  section: { marginTop: spacing.xxxl },
  bleed: { marginHorizontal: -screenGutter },
  railContent: { paddingHorizontal: screenGutter },
  hint: { marginTop: spacing.sm },
  coachSkeletons: { flexDirection: 'row', gap: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridItem: { flexBasis: '47%', flexGrow: 1 },
});
