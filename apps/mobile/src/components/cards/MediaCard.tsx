import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Artwork } from '@/components/brand/Artwork';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';
import type { ActivityCategory } from '@/types/domain';

export type MediaCardProps = {
  title: string;
  imageUrl?: string | null;
  /** Fallback artwork when there is no photo. */
  category?: ActivityCategory;
  eyebrow?: string;
  subtitle?: string;
  onPress?: () => void;
  height?: number;
  width?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Photography-first card with text over a bottom scrim. Used for activities
 * and featured content. Falls back to category artwork without a photo.
 */
export function MediaCard({
  title,
  imageUrl,
  category,
  eyebrow,
  subtitle,
  onPress,
  height = 220,
  width,
  style,
}: MediaCardProps) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      scaleTo={0.98}
      accessibilityLabel={[eyebrow, title, subtitle].filter(Boolean).join(', ')}
      style={[styles.card, { height, width }, style]}>
      <Artwork imageUrl={imageUrl} category={category} iconSize={height * 0.7} style={StyleSheet.absoluteFill} />
      {imageUrl ? <View style={styles.scrim} /> : null}
      <View style={styles.content}>
        {eyebrow && (
          <Text variant="overline" color="accent" uppercase numberOfLines={1}>
            {eyebrow}
          </Text>
        )}
        <Text variant="heading" numberOfLines={2}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="caption" color="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'flex-end',
  },
  // Flat scrim keeps text legible on any photo without heavy gradients.
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
    backgroundColor: colors.overlay,
  },
  content: { padding: spacing.lg, gap: spacing.xs },
});
