import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'error';

const tones: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceSecondary, fg: colors.textSecondary },
  accent: { bg: colors.primaryMuted, fg: colors.primary },
  success: { bg: 'rgba(61, 220, 132, 0.14)', fg: colors.success },
  warning: { bg: 'rgba(255, 176, 32, 0.14)', fg: colors.warning },
  error: { bg: 'rgba(255, 90, 95, 0.14)', fg: colors.error },
};

export type BadgeProps = {
  label: string;
  tone?: Tone;
  icon?: IconName;
};

/** Small status / metadata pill (level, "Mode Invité", invitation state…). */
export function Badge({ label, tone = 'neutral', icon }: BadgeProps) {
  const t = tones[tone];
  return (
    <View style={[styles.base, { backgroundColor: t.bg }]}>
      {icon && <Icon name={icon} size={12} color={t.fg} />}
      <Text variant="caption" style={{ color: t.fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
});
