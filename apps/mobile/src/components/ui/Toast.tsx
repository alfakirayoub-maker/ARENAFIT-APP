import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, screenGutter, spacing } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type ToastMessage = { id: number; text: string; icon: IconName };
type ToastContextValue = { show: (text: string, icon?: IconName) => void };

const ToastContext = createContext<ToastContextValue | null>(null);
const DURATION_MS = 2200;

/** Short confirmation feedback (e.g. "Rappel activé"). One toast at a time. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const insets = useSafeAreaInsets();

  const show = useCallback((text: string, icon: IconName = 'checkmark-circle') => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), text, icon });
    AccessibilityInfo.announceForAccessibility(text);
    timer.current = setTimeout(() => setToast(null), DURATION_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View pointerEvents="none" style={[styles.host, { top: insets.top + spacing.sm }]}>
        {toast && (
          <Animated.View key={toast.id} entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)} style={styles.toast}>
            <Icon name={toast.icon} size={18} color={colors.primary} />
            <Text variant="label">{toast.text}</Text>
          </Animated.View>
        )}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: screenGutter, right: screenGutter, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
