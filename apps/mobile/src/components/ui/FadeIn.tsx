import type { ReactNode } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { motion } from '@/theme';

export type FadeInProps = {
  children: ReactNode;
  /** Position in a list, used to stagger entrances. */
  index?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Subtle card entrance (fade + short rise). Reanimated layout animations follow
 * the OS reduced-motion setting by default.
 */
export function FadeIn({ children, index = 0, style }: FadeInProps) {
  return (
    <Animated.View
      entering={
        // Reanimated web leaves entering views absolutely positioned; web is
        // only used for QA, so animate on native only.
        Platform.OS === 'web'
          ? undefined
          : FadeInDown.duration(motion.duration.slow).delay(Math.min(index, 8) * motion.stagger)
      }
      style={style}>
      {children}
    </Animated.View>
  );
}
