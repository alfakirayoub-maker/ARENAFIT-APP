import { StyleSheet } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

/** Selectable filter chip (planning categories, activity filters…). */
export function Chip({ label, selected = false, onPress }: ChipProps) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.base, selected ? styles.selected : styles.idle]}>
      <Text variant="label" style={{ color: selected ? colors.onPrimary : colors.textPrimary }}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { backgroundColor: colors.surfaceSecondary },
  selected: { backgroundColor: colors.primary },
});
