import { StyleSheet } from 'react-native';

import { colors, hitTarget, radius } from '@/theme';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

export type IconButtonProps = {
  icon: IconName;
  /** Required: icon-only controls must be labelled for screen readers. */
  accessibilityLabel: string;
  onPress?: () => void;
  active?: boolean;
  disabled?: boolean;
  variant?: 'filled' | 'plain';
  size?: number;
};

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  active,
  disabled,
  variant = 'filled',
  size = hitTarget,
}: IconButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active, disabled }}
      hitSlop={Math.max(0, (hitTarget - size) / 2)}
      style={[
        styles.base,
        { width: size, height: size },
        variant === 'filled' && { backgroundColor: active ? colors.primaryMuted : colors.surfaceSecondary },
      ]}>
      <Icon name={icon} size={Math.round(size * 0.45)} color={active ? colors.primary : colors.textPrimary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
