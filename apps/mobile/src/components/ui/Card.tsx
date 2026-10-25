import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { PressableScale } from './PressableScale';

export type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  variant?: 'default' | 'raised' | 'accent';
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

const backgrounds = {
  default: colors.surface,
  raised: colors.surfaceSecondary,
  accent: colors.primaryMuted,
} as const;

/** Rounded surface container. Becomes pressable when `onPress` is given. */
export function Card({ children, onPress, accessibilityLabel, variant = 'default', padded = true, style }: CardProps) {
  const cardStyle = [styles.base, { backgroundColor: backgrounds[variant] }, padded && styles.padded, style];

  if (onPress) {
    return (
      <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel} scaleTo={0.98} style={cardStyle}>
        {children}
      </PressableScale>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.xl, overflow: 'hidden' },
  padded: { padding: spacing.xl },
});
