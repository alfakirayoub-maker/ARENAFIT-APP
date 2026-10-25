import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, screenGutter, spacing } from '@/theme';

import { Text } from './Text';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  closeLabel: string;
};

/** Lightweight modal sheet (native Modal, no extra dependency). */
export function BottomSheet({ visible, onClose, title, subtitle, children, closeLabel }: BottomSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm }]}
          accessibilityViewIsModal>
          <View style={styles.handle} />
          <Text variant="heading" accessibilityRole="header">
            {title}
          </Text>
          {subtitle && (
            <Text variant="body" color="secondary" style={styles.subtitle}>
              {subtitle}
            </Text>
          )}
          <View style={styles.content}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: screenGutter,
    paddingTop: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfacePressed,
    marginBottom: spacing.lg,
  },
  subtitle: { marginTop: spacing.xs },
  content: { marginTop: spacing.xl, gap: spacing.sm },
});
