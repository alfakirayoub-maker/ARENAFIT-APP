import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius, spacing } from '@/theme';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Soft pulsing placeholder. Static when the OS asks for reduced motion. */
export function Skeleton({ width = '100%', height = 16, borderRadius = radius.sm, style }: SkeletonProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius, backgroundColor: colors.skeleton }, animatedStyle, style]}
    />
  );
}

/** Placeholder shaped like a class card (planning / home lists). */
export function ClassCardSkeleton() {
  const { t } = useTranslation();
  return (
    <View style={styles.classCard} accessibilityLabel={t('common.loading')} accessibilityRole="progressbar">
      <View style={styles.timeCol}>
        <Skeleton width={44} height={18} />
        <Skeleton width={36} height={12} />
      </View>
      <View style={styles.body}>
        <Skeleton width="60%" height={18} />
        <Skeleton width="80%" height={12} />
        <Skeleton width={72} height={22} borderRadius={radius.pill} />
      </View>
    </View>
  );
}

/** Placeholder shaped like an image card (activities / news). */
export function MediaCardSkeleton({ height = 200 }: { height?: number }) {
  return (
    <View style={styles.media}>
      <Skeleton height={height} borderRadius={radius.xl} />
      <Skeleton width="70%" height={18} />
      <Skeleton width="45%" height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  classCard: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  timeCol: { gap: spacing.sm, alignItems: 'flex-start' },
  body: { flex: 1, gap: spacing.sm },
  media: { gap: spacing.sm },
});
