import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type EmptyStateProps = {
  icon: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
};

/** Used wherever a list can be empty — never leave a blank screen. */
export function EmptyState({ icon, title, body, actionLabel, onAction, compact }: EmptyStateProps) {
  return (
    <View style={[styles.container, compact && styles.compact]} accessibilityRole="summary">
      <View style={styles.iconWrap}>
        <Icon name={icon} size={26} color={colors.primary} />
      </View>
      <Text variant="subheading" align="center">
        {title}
      </Text>
      {body && (
        <Text variant="body" color="secondary" align="center" style={styles.body}>
          {body}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} variant="secondary" style={styles.action} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.huge,
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  compact: {
    paddingVertical: spacing.xxl,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  body: { maxWidth: 300 },
  action: { marginTop: spacing.md, alignSelf: 'center' },
});
