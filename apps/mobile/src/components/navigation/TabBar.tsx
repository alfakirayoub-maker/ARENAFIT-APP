import { StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors, hitTarget, spacing } from '@/theme';

/** Icons per route name (file name under app/(tabs)). */
const icons: Record<string, { active: IconName; idle: IconName }> = {
  index: { active: 'home', idle: 'home-outline' },
  planning: { active: 'calendar', idle: 'calendar-outline' },
  activites: { active: 'flash', idle: 'flash-outline' },
  actualites: { active: 'newspaper', idle: 'newspaper-outline' },
  profil: { active: 'person', idle: 'person-outline' },
};

/** Five equal tabs — no oversized center action (Guest Pass stays secondary). */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {state.routes.map((route, index) => {
        const focused = index === state.index;
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const icon = icons[route.name] ?? { active: 'ellipse', idle: 'ellipse-outline' };
        const tint = focused ? colors.primary : colors.textTertiary;

        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };

        return (
          <PressableScale
            key={route.key}
            onPress={onPress}
            onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
            haptic="selection"
            scaleTo={0.92}
            accessibilityRole="tab"
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            accessibilityState={{ selected: focused }}
            style={styles.item}>
            <Icon name={focused ? icon.active : icon.idle} size={22} color={tint} />
            <Text variant="tab" style={{ color: tint }} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  item: {
    flex: 1,
    minHeight: hitTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
});
