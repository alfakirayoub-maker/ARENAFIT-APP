import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ClassCard } from '@/components/cards/ClassCard';
import { WeekSelector } from '@/components/planning/WeekSelector';
import { ChipRow, type ChipOption } from '@/components/ui/ChipRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FadeIn } from '@/components/ui/FadeIn';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ClassCardSkeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useSessions } from '@/data/queries';
import { addDays, clubNow, formatDayLong, startOfWeek, type ClubDate } from '@/lib/club-time';
import { colors, spacing } from '@/theme';
import { activityCategories, type ActivityCategory } from '@/types/domain';

type CategoryFilter = 'all' | ActivityCategory;

/** How far ahead members can browse. The admin publishes ~2 weeks ahead. */
const MAX_WEEKS_AHEAD = 3;

export default function PlanningScreen() {
  const { t } = useTranslation();
  const today = clubNow().date;
  const currentMonday = startOfWeek(today);

  const [monday, setMonday] = useState<ClubDate>(currentMonday);
  const [selected, setSelected] = useState<ClubDate>(today);
  const [category, setCategory] = useState<CategoryFilter>('all');

  const sessionsQuery = useSessions(monday, addDays(monday, 6));
  const weekSessions = sessionsQuery.data ?? [];
  const daySessions = weekSessions.filter(
    (s) => s.date === selected && (category === 'all' || s.activity.category === category),
  );
  const datesWithClasses = new Set(weekSessions.map((s) => s.date));

  const goToWeek = (offsetWeeks: number) => {
    const next = addDays(monday, offsetWeeks * 7);
    setMonday(next);
    // Keep "today" selected when coming back to the current week.
    setSelected(next === currentMonday ? today : next);
  };

  const categoryOptions: ChipOption<CategoryFilter>[] = [
    { value: 'all', label: t('categories.all') },
    ...activityCategories.map((c) => ({ value: c, label: t(`categories.${c}`) })),
  ];

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={sessionsQuery.isRefetching}
          onRefresh={() => void sessionsQuery.refetch()}
          tintColor={colors.primary}
        />
      }>
      <ScreenHeader title={t('planning.title')} subtitle={t('planning.subtitle')} />

      <WeekSelector
        monday={monday}
        selected={selected}
        today={today}
        onSelect={setSelected}
        datesWithClasses={datesWithClasses}
        onPreviousWeek={monday > currentMonday ? () => goToWeek(-1) : undefined}
        onNextWeek={monday < addDays(currentMonday, MAX_WEEKS_AHEAD * 7) ? () => goToWeek(1) : undefined}
      />

      <View style={styles.filters}>
        <ChipRow options={categoryOptions} value={category} onChange={setCategory} />
      </View>

      <View style={styles.dayHeader}>
        <Text variant="heading" accessibilityRole="header">
          {selected === today ? t('common.today') : formatDayLong(selected)}
        </Text>
        {!sessionsQuery.isPending && daySessions.length > 0 && (
          <Text variant="caption" color="tertiary">
            {t('planning.sessionCount', { count: daySessions.length })}
          </Text>
        )}
      </View>

      {sessionsQuery.isPending ? (
        <View style={styles.list}>
          <ClassCardSkeleton />
          <ClassCardSkeleton />
          <ClassCardSkeleton />
        </View>
      ) : sessionsQuery.isError ? (
        <ErrorState compact onRetry={() => sessionsQuery.refetch()} />
      ) : daySessions.length > 0 ? (
        <View style={styles.list}>
          {daySessions.map((s, i) => (
            <FadeIn key={s.id} index={i}>
              <ClassCard session={s} />
            </FadeIn>
          ))}
        </View>
      ) : (
        <EmptyState
          compact
          icon="calendar-clear-outline"
          title={t('planning.empty.title')}
          body={t('planning.empty.body')}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { marginTop: spacing.xl },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  list: { gap: spacing.md },
});
