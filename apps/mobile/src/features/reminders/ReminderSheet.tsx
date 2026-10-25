import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { haptics } from '@/lib/haptics';
import { colors, radius, spacing } from '@/theme';
import type { ClassSession } from '@/types/domain';

import { reminderOffsets, useReminders, type ReminderOffset } from './store';

type ReminderSheetContextValue = { open: (session: ClassSession) => void };
const ReminderSheetContext = createContext<ReminderSheetContextValue | null>(null);

export function useReminderOffsetLabel() {
  const { t } = useTranslation();
  return (offset: ReminderOffset) => t(`reminder.offset${offset}`);
}

/**
 * Hosts the single "Me le rappeler" sheet used by every class card and the
 * class detail screen. Choosing an offset stores a reminder — never a booking.
 */
export function ReminderSheetProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const toast = useToast();
  const reminders = useReminders();
  const offsetLabel = useReminderOffsetLabel();
  const [session, setSession] = useState<ClassSession | null>(null);

  const open = useCallback((s: ClassSession) => setSession(s), []);
  const close = () => setSession(null);
  const current = session ? reminders.offsetFor(session.id) : undefined;

  const choose = (offset: ReminderOffset) => {
    if (!session) return;
    reminders.set(session.id, offset);
    haptics.success();
    toast.show(t('reminder.confirmed', { offset: offsetLabel(offset) }), 'notifications');
    close();
  };

  const remove = () => {
    if (!session) return;
    reminders.remove(session.id);
    toast.show(t('reminder.removed'), 'notifications-off-outline');
    close();
  };

  const value = useMemo(() => ({ open }), [open]);

  return (
    <ReminderSheetContext.Provider value={value}>
      {children}
      <BottomSheet
        visible={session !== null}
        onClose={close}
        closeLabel={t('common.close')}
        title={session ? `${t('reminder.sheetTitle')} · ${session.activity.name}` : ''}
        subtitle={t('reminder.sheetBody')}>
        {reminderOffsets.map((offset) => {
          const selected = offset === current;
          return (
            <PressableScale
              key={offset}
              onPress={() => choose(offset)}
              haptic="selection"
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={offsetLabel(offset)}
              style={[styles.option, selected && styles.optionSelected]}>
              <Text variant="bodyStrong" style={{ color: selected ? colors.primary : colors.textPrimary }}>
                {offsetLabel(offset)}
              </Text>
              {selected && <Icon name="checkmark-circle" size={22} color={colors.primary} />}
            </PressableScale>
          );
        })}
        <View style={styles.footer}>
          <Icon name="information-circle-outline" size={16} color={colors.textTertiary} />
          <Text variant="caption" color="tertiary" style={styles.footerText}>
            {t('classDetail.notAReservation')}
          </Text>
        </View>
        {current !== undefined && (
          <Button label={t('reminder.remove')} variant="ghost" icon="trash-outline" fullWidth onPress={remove} />
        )}
      </BottomSheet>
    </ReminderSheetContext.Provider>
  );
}

export function useReminderSheet(): ReminderSheetContextValue {
  const ctx = useContext(ReminderSheetContext);
  if (!ctx) throw new Error('useReminderSheet must be used inside <ReminderSheetProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  option: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
  },
  optionSelected: { backgroundColor: colors.primaryMuted },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginVertical: spacing.sm },
  footerText: { flex: 1 },
});
