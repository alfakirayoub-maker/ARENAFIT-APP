import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { NewsCard } from '@/components/cards/NewsCard';
import { ChipRow, type ChipOption } from '@/components/ui/ChipRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FadeIn } from '@/components/ui/FadeIn';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { MediaCardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { queryKeys, useNews, useNewsCategories, useRefresh } from '@/data/queries';
import { colors, radius, spacing } from '@/theme';
import type { NewsCategory } from '@/types/domain';

type Filter = 'all' | NewsCategory;

export default function NewsScreen() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');
  // Same cached list for both: filtering and categories cost no extra request.
  const newsQuery = useNews(filter === 'all' ? undefined : filter);
  const categoriesQuery = useNewsCategories();
  const refresh = useRefresh(queryKeys.news);

  const [lead, ...rest] = newsQuery.data ?? [];

  // Only offer categories that actually have published articles.
  const usedCategories = categoriesQuery.data ?? [];
  const options: ChipOption<Filter>[] = [
    { value: 'all', label: t('newsCategories.all') },
    ...usedCategories.map((c) => ({ value: c, label: t(`newsCategories.${c}`) })),
  ];

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refresh.refreshing} onRefresh={refresh.onRefresh} tintColor={colors.primary} />
      }>
      <ScreenHeader title={t('news.title')} subtitle={t('news.subtitle')} />

      {newsQuery.data === undefined && !newsQuery.isError ? (
        <View style={styles.list}>
          <MediaCardSkeleton height={190} />
          <Skeleton height={136} borderRadius={radius.xl} />
          <Skeleton height={136} borderRadius={radius.xl} />
        </View>
      ) : newsQuery.data === undefined ? (
        <ErrorState onRetry={() => newsQuery.refetch()} />
      ) : usedCategories.length === 0 ? (
        <EmptyState icon="newspaper-outline" title={t('empty.noNews.title')} body={t('empty.noNews.body')} />
      ) : (
        <>
          {usedCategories.length > 1 && (
            <View style={styles.filters}>
              <ChipRow options={options} value={filter} onChange={setFilter} />
            </View>
          )}
          <View style={styles.list}>
            {lead && (
              <FadeIn>
                <NewsCard article={lead} featured />
              </FadeIn>
            )}
            {rest.map((a, i) => (
              <FadeIn key={a.id} index={i + 1}>
                <NewsCard article={a} />
              </FadeIn>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { marginBottom: spacing.xl },
  list: { gap: spacing.md },
});
