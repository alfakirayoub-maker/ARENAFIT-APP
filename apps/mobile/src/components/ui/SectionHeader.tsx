import { StyleSheet, View } from 'react-native';

import { hitTarget, spacing } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text variant="heading" accessibilityRole="header" style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {actionLabel && onAction && (
        <PressableScale onPress={onAction} accessibilityRole="link" accessibilityLabel={actionLabel} style={styles.action}>
          <Text variant="label" color="accent">
            {actionLabel}
          </Text>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { flexShrink: 1 },
  action: { minHeight: hitTarget, justifyContent: 'center', paddingLeft: spacing.md },
});
