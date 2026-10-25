import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, screenGutter, spacing } from '@/theme';

export type ScreenProps = {
  children: ReactNode;
  /** Scrollable by default; pass false for screens managing their own list. */
  scroll?: boolean;
  /** Apply the standard horizontal gutter. */
  padded?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
};

/** Root container for tab screens: background, safe area and gutters. */
export function Screen({ children, scroll = true, padded = true, refreshControl }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const contentStyle = [
    padded && styles.padded,
    { paddingTop: insets.top, paddingBottom: spacing.huge },
  ];

  if (!scroll) {
    return <View style={[styles.root, ...contentStyle]}>{children}</View>;
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
      contentInsetAdjustmentBehavior="never">
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  padded: { paddingHorizontal: screenGutter },
});
