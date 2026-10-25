import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Text } from './Text';

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Optional element above the title (logo, badge…). */
  eyebrow?: ReactNode;
  /** Optional trailing element (icon button, avatar…). */
  right?: ReactNode;
};

/** Large-title header used at the top of every tab screen. */
export function ScreenHeader({ title, subtitle, eyebrow, right }: ScreenHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.text}>
        {eyebrow}
        <Text variant="display" accessibilityRole="header">
          {title}
        </Text>
        {subtitle && (
          <Text variant="body" color="secondary">
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  text: { flex: 1, gap: spacing.xs },
});
