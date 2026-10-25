import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

/** 1–5 bars. Label it from the parent (e.g. "Intensité 3 sur 5"). */
export function IntensityMeter({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <View style={styles.row} accessible={false}>
      {Array.from({ length: max }, (_, i) => (
        <View
          key={i}
          style={[styles.bar, { height: 8 + i * 3 }, { backgroundColor: i < value ? colors.primary : colors.surfacePressed }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xxs + 1 },
  bar: { width: 6, borderRadius: radius.sm },
});
