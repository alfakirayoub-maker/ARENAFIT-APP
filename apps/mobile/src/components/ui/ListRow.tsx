import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type ListRowProps = {
  label: string;
  icon?: IconName;
  hint?: string;
  value?: string;
  onPress?: () => void;
  /** Renders a switch instead of a chevron. */
  toggle?: { value: boolean; onChange: (value: boolean) => void };
  destructive?: boolean;
};

/** Settings-style row. Use inside <ListGroup>. */
export function ListRow({ label, icon, hint, value, onPress, toggle, destructive }: ListRowProps) {
  const tint = destructive ? colors.error : colors.textPrimary;

  const content = (
    <>
      {icon && (
        <View style={styles.iconWrap}>
          <Icon name={icon} size={18} color={tint} />
        </View>
      )}
      <View style={styles.text}>
        <Text variant="bodyStrong" style={{ color: tint }}>
          {label}
        </Text>
        {hint && (
          <Text variant="caption" color="tertiary">
            {hint}
          </Text>
        )}
      </View>
      {value && (
        <Text variant="body" color="secondary">
          {value}
        </Text>
      )}
      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onChange}
          trackColor={{ false: colors.surfacePressed, true: colors.primary }}
          thumbColor={colors.textPrimary}
          ios_backgroundColor={colors.surfacePressed}
          accessibilityLabel={label}
        />
      ) : (
        onPress && <Icon name="chevron-forward" size={18} color={colors.textTertiary} />
      )}
    </>
  );

  if (onPress && !toggle) {
    return (
      <PressableScale onPress={onPress} scaleTo={0.99} accessibilityLabel={label} style={styles.row}>
        {content}
      </PressableScale>
    );
  }
  return <View style={styles.row}>{content}</View>;
}

/** Rounded group with hairline separators between rows. */
export function ListGroup({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {items.map((child, i) => (
        <Fragment key={i}>
          {i > 0 && <View style={styles.separator} />}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: spacing.xxs },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing.lg },
});
