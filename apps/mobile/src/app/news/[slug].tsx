import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Artwork } from '@/components/brand/Artwork';
import { Badge } from '@/components/ui/Badge';
import { DetailScreen } from '@/components/ui/DetailScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useArticle } from '@/data/queries';
import { formatPublishedAt } from '@/lib/club-time';
import { spacing } from '@/theme';

export default function ArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const articleQuery = useArticle(slug);
  const article = articleQuery.data;

  if (articleQuery.isPending) {
    return (
      <DetailScreen hero={<Skeleton height="100%" borderRadius={0} />}>
        <Skeleton width="80%" height={32} />
        <Skeleton height={14} />
        <Skeleton height={14} />
        <Skeleton width="60%" height={14} />
      </DetailScreen>
    );
  }
  if (articleQuery.isError) {
    return (
      <DetailScreen>
        <ErrorState onRetry={() => articleQuery.refetch()} />
      </DetailScreen>
    );
  }
  if (!article) {
    return (
      <DetailScreen>
        <EmptyState icon="newspaper-outline" title={t('news.notFound')} />
      </DetailScreen>
    );
  }

  return (
    <DetailScreen hero={<Artwork imageUrl={article.coverUrl} iconSize={300} style={styles.hero} />} heroHeight={260}>
      <View style={styles.header}>
        <View style={styles.meta}>
          <Badge label={t(`newsCategories.${article.category}`)} tone="accent" />
          <Text variant="caption" color="tertiary">
            {formatPublishedAt(article.publishedAt)}
          </Text>
        </View>
        <Text variant="title" accessibilityRole="header">
          {article.title}
        </Text>
        <Text variant="subheading" color="secondary">
          {article.excerpt}
        </Text>
      </View>
      <View style={styles.body}>
        {article.body.split(/\n{2,}/).map((paragraph, i) => (
          <Text key={i} variant="body" color="secondary" style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}
      </View>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1 },
  header: { gap: spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { gap: spacing.lg },
  paragraph: { fontSize: 16, lineHeight: 26 },
});
