import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, screenGutter, spacing } from '@/theme';

import { IconButton } from './IconButton';

export type DetailScreenProps = {
  /** Full-bleed hero (artwork / photo). */
  hero?: ReactNode;
  heroHeight?: number;
  /** Trailing action over the hero (favorite…). */
  headerRight?: ReactNode;
  /** Sticky bottom area (main CTA). */
  footer?: ReactNode;
  children: ReactNode;
};

/** Layout for pushed detail screens: hero, floating back button, sticky CTA. */
export function DetailScreen({ hero, heroHeight = 300, headerRight, footer, children }: DetailScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: footer ? 180 : spacing.huge }}>
        {hero ? <View style={{ height: heroHeight + insets.top }}>{hero}</View> : <View style={{ height: insets.top + 64 }} />}
        <View style={styles.content}>{children}</View>
      </ScrollView>

      <View style={[styles.topBar, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
        <IconButton
          icon="chevron-back"
          accessibilityLabel={t('common.back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        {headerRight}
      </View>

      {footer && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>{footer}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: screenGutter, paddingTop: spacing.xxl, gap: spacing.xxl },
  topBar: {
    position: 'absolute',
    left: screenGutter,
    right: screenGutter,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: screenGutter,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
});
