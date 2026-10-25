import { ScrollView, StyleSheet } from 'react-native';

import { screenGutter, spacing } from '@/theme';

import { Chip } from './Chip';

export type ChipOption<T extends string> = { value: T; label: string };

export type ChipRowProps<T extends string> = {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Bleed to the screen edges when placed inside a padded screen. */
  bleed?: boolean;
};

/** Horizontally scrolling single-select filter (categories…). */
export function ChipRow<T extends string>({ options, value, onChange, bleed = true }: ChipRowProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      style={bleed && styles.bleed}
      contentContainerStyle={[styles.content, bleed && styles.bleedContent]}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  bleed: { marginHorizontal: -screenGutter },
  bleedContent: { paddingHorizontal: screenGutter },
});
