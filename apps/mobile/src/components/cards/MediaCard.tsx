import { Image, type ImageSource } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';

export type MediaCardProps = {
  title: string;
  image?: ImageSource | string | null;
  eyebrow?: string;
  subtitle?: string;
  onPress?: () => void;
  height?: number;
  width?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Photography-first card with text over a bottom scrim. Used for activities,
 * coaches and news. Falls back to a plain surface when there is no image.
 */
export function MediaCard({ title, image, eyebrow, subtitle, onPress, height = 220, width, style }: MediaCardProps) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      scaleTo={0.98}
      accessibilityLabel={[eyebrow, title, subtitle].filter(Boolean).join(', ')}
      style={[styles.card, { height, width }, style]}>
      {image ? (
        <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} accessible={false} />
      ) : null}
      <View style={styles.scrim} />
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
