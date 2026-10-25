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
import { useNews } from '@/data/queries';
import { colors, radius, spacing } from '@/theme';
import type { NewsCategory } from '@/types/domain';

type Filter = 'all' | NewsCategory;

export default function NewsScreen() {
  const { t } = useTranslation();
  const newsQuery = useNews();
  const [filter, setFilter] = useState<Filter>('all');

  const articles = newsQuery.data ?? [];
  const visible = filter === 'all' ? articles : articles.filter((a) => a.category === filter);
  const [lead, ...rest] = visible;

  // Only offer categories that actually have articles.
  const usedCategories = [...new Set(articles.map((a) => a.category))];
  const options: ChipOption<Filter>[] = [
    { value: 'all', label: t('newsCategories.all') },
    ...usedCategories.map((c) => ({ value: c, label: t(`newsCategories.${c}`) })),
  ];

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={newsQuery.isRefetching} onRefresh={() => void newsQuery.refetch()} tintColor={colors.primary} />
      }>
      <ScreenHeader title={t('news.title')} subtitle={t('news.subtitle')} />

      {newsQuery.isPending ? (
        <View style={styles.list}>
          <MediaCardSkeleton height={190} />
          <Skeleton height={136} borderRadius={radius.xl} />
          <Skeleton height={136} borderRadius={radius.xl} />
        </View>
      ) : newsQuery.isError ? (
        <ErrorState onRetry={() => newsQuery.refetch()} />
      ) : articles.length === 0 ? (
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
