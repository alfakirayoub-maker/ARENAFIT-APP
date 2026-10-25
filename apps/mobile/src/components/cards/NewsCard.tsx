import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Artwork } from '@/components/brand/Artwork';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { formatPublishedAt } from '@/lib/club-time';
import { colors, radius, spacing } from '@/theme';
import type { NewsArticle } from '@/types/domain';

export type NewsCardProps = {
  article: NewsArticle;
  /** Large cover layout for the lead article. */
  featured?: boolean;
};

/** Image, category, title, excerpt and date. */
export function NewsCard({ article, featured }: NewsCardProps) {
  const { t } = useTranslation();
  const category = t(`newsCategories.${article.category}`);
  const date = formatPublishedAt(article.publishedAt);
  const open = () => router.push({ pathname: '/news/[slug]', params: { slug: article.slug } });

  return (
    <PressableScale
      onPress={open}
      scaleTo={0.98}
      accessibilityLabel={`${category}, ${article.title}, ${date}`}
      style={featured ? styles.featured : styles.row}>
      <Artwork
        imageUrl={article.coverUrl}
        iconSize={featured ? 180 : 70}
        style={featured ? styles.featuredImage : styles.thumb}
      />
      <View style={featured ? styles.featuredBody : styles.body}>
        <Text variant="overline" color="accent" uppercase numberOfLines={1}>
          {category}
        </Text>
        <Text variant={featured ? 'heading' : 'subheading'} numberOfLines={2}>
          {article.title}
        </Text>
        <Text variant="caption" color="secondary" numberOfLines={featured ? 3 : 2}>
          {article.excerpt}
        </Text>
        <Text variant="caption" color="tertiary">
          {date}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  featured: { borderRadius: radius.xl, backgroundColor: colors.surface, overflow: 'hidden' },
  featuredImage: { height: 190 },
  featuredBody: { padding: spacing.xl, gap: spacing.xs },
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  thumb: { width: 96, height: 112, borderRadius: radius.lg },
  body: { flex: 1, gap: spacing.xxs, justifyContent: 'center' },
});
