import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { useNotificationPreferences } from '@/features/settings/notification-preferences';
import { clubWallClock } from '@/lib/club-clock';
import { haptics } from '@/lib/haptics';
import { colors, radius, spacing } from '@/theme';
import type { ClassSession } from '@/types/domain';

import { useClassReminderPreference, useReminder } from './hooks';
import { reminderService } from './index';
import { availableOffsets } from './logic';
import type { ScheduleResult } from './service';
import type { ReminderOffset } from './types';

type ReminderSheetContextValue = { open: (session: ClassSession) => void };
const ReminderSheetContext = createContext<ReminderSheetContextValue | null>(null);

export function useReminderOffsetLabel() {
  const { t } = useTranslation();
  return (offset: ReminderOffset) => t(`reminder.offset${offset}`);
}

type View_ = 'choose' | 'manage' | 'explain' | 'denied';

/**
 * The single "Me le rappeler" sheet used by class cards, Accueil and Class
 * Details. Flows:
 *   no reminder → choose an offset (only offsets still possible)
 *   reminder    → manage: Modifier (choose again, same reminder) / Supprimer
 *   first time  → short explanation → OS permission prompt → scheduled
 *   refused     → explanation + open system settings; never re-prompts
 * A reminder is never a reservation.
 */
export function ReminderSheetProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ClassSession | null>(null);
  const open = useCallback((s: ClassSession) => setSession(s), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <ReminderSheetContext.Provider value={value}>
      {children}
      {session && <ReminderSheet key={session.id} session={session} onClose={() => setSession(null)} />}
    </ReminderSheetContext.Provider>
  );
}

export function useReminderSheet(): ReminderSheetContextValue {
  const ctx = useContext(ReminderSheetContext);
  if (!ctx) throw new Error('useReminderSheet must be used inside <ReminderSheetProvider>');
  return ctx;
}

function ReminderSheet({ session, onClose }: { session: ClassSession; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const offsetLabel = useReminderOffsetLabel();
  const record = useReminder(session.id);
  const { prefs } = useNotificationPreferences();
  const [, setRemindersEnabled] = useClassReminderPreference();

  const [view, setView] = useState<View_>(record ? 'manage' : 'choose');
  const [pendingOffset, setPendingOffset] = useState<ReminderOffset | null>(null);
  const [busy, setBusy] = useState(false);

  const offsets = availableOffsets(session, new Date());
  const simulated = reminderService.kind === 'simulated';

  const handleResult = (result: ScheduleResult, offset: ReminderOffset, isUpdate: boolean) => {
    switch (result.status) {
      case 'scheduled':
      case 'saved':
        haptics.success();
        toast.show(t(isUpdate ? 'reminder.updated' : 'reminder.confirmed', { offset: offsetLabel(offset) }), 'notifications');
        onClose();
        return;
      case 'permission-required':
        setPendingOffset(offset);
        setView('explain');
        return;
      case 'permission-denied':
        setPendingOffset(offset);
        setView('denied');
        return;
      case 'unavailable':
        toast.show(t('reminder.tooLate'), 'time-outline');
        onClose();
        return;
    }
  };

  const choose = async (offset: ReminderOffset) => {
    if (busy) return;
    setBusy(true);
    try {
      // Setting a reminder is an explicit request: turn class reminders back on if they were off.
      if (!prefs.classReminders) {
        setRemindersEnabled(true);
        toast.show(t('reminder.remindersReenabled'), 'notifications');
      }
      const isUpdate = record !== undefined;
      handleResult(await reminderService.scheduleClassReminder(session, offset), offset, isUpdate);
    } catch {
      toast.show(t('reminder.error'), 'alert-circle-outline');
    } finally {
      setBusy(false);
    }
  };

  const allow = async () => {
    if (busy || pendingOffset === null) return;
    setBusy(true);
    try {
      const permission = await reminderService.requestPermission();
      if (permission === 'granted' || permission === 'unavailable') {
        handleResult(await reminderService.scheduleClassReminder(session, pendingOffset), pendingOffset, record !== undefined);
      } else {
        setView('denied');
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    await reminderService.cancelClassReminder(session.id);
    toast.show(t('reminder.removed'), 'notifications-off-outline');
    onClose();
  };

  const common = { visible: true, onClose, closeLabel: t('common.close') };

  if (view === 'explain') {
    return (
      <BottomSheet {...common} title={t('reminder.permissionTitle')} subtitle={t('reminder.permissionBody')}>
        <View style={styles.illustration}>
          <Icon name="notifications" size={28} color={colors.primary} />
        </View>
        <Button label={t('reminder.permissionAllow')} size="lg" fullWidth loading={busy} onPress={allow} />
        <Button label={t('reminder.permissionLater')} variant="ghost" fullWidth onPress={onClose} />
        <NotAReservation />
      </BottomSheet>
    );
  }

  if (view === 'denied') {
    return (
      <BottomSheet {...common} title={t('reminder.deniedTitle')} subtitle={t('reminder.deniedBody')}>
        <View style={[styles.illustration, styles.illustrationMuted]}>
          <Icon name="notifications-off-outline" size={28} color={colors.textSecondary} />
        </View>
        <Button
          label={t('reminder.openSettings')}
          icon="settings-outline"
          size="lg"
          fullWidth
          onPress={() => {
            void reminderService.openSettings();
            onClose();
          }}
        />
        <Button label={t('common.close')} variant="ghost" fullWidth onPress={onClose} />
      </BottomSheet>
    );
  }

  if (view === 'manage' && record) {
    const fireTime = clubWallClock(new Date(record.triggerAt)).time;
    return (
      <BottomSheet {...common} title={`${t('reminder.manageTitle')} · ${session.activity.name}`}>
        <View style={styles.status} accessible accessibilityLabel={t('reminder.activeLabel', { offset: offsetLabel(record.offsetMinutes) })}>
          <Icon name="checkmark-circle" size={22} color={colors.primary} />
          <View style={styles.statusText}>
            <Text variant="bodyStrong" color="accent">
              {t('reminder.activeLabel', { offset: offsetLabel(record.offsetMinutes) })}
            </Text>
            <Text variant="caption" color="secondary">
              {session.startTime} – {session.endTime} · {t('reminder.firesAt', { time: fireTime })}
            </Text>
          </View>
        </View>
        {!prefs.classReminders && <Note icon="notifications-off-outline" text={t('reminder.remindersOff')} />}
        {simulated && <Note icon="globe-outline" text={t('reminder.simulatedNote')} />}
        {offsets.length > 0 && (
          <Button label={t('reminder.modify')} icon="create-outline" variant="secondary" fullWidth onPress={() => setView('choose')} />
        )}
        <Button label={t('reminder.remove')} icon="trash-outline" variant="ghost" fullWidth onPress={remove} />
        <NotAReservation />
      </BottomSheet>
    );
  }

  // choose
  return (
    <BottomSheet
      {...common}
      title={`${t('reminder.sheetTitle')} · ${session.activity.name}`}
      subtitle={offsets.length > 0 ? t('reminder.sheetBody') : t('reminder.tooLateBody')}>
      {offsets.map((offset) => {
        const selected = offset === record?.offsetMinutes;
        return (
          <PressableScale
            key={offset}
            onPress={() => void choose(offset)}
            disabled={busy}
            haptic="selection"
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled: busy }}
            accessibilityLabel={offsetLabel(offset)}
            style={[styles.option, selected && styles.optionSelected]}>
            <Text variant="bodyStrong" style={{ color: selected ? colors.primary : colors.textPrimary }}>
              {offsetLabel(offset)}
            </Text>
            {selected && <Icon name="checkmark-circle" size={22} color={colors.primary} />}
          </PressableScale>
        );
      })}
      {simulated && offsets.length > 0 && <Note icon="globe-outline" text={t('reminder.simulatedNote')} />}
      <NotAReservation />
    </BottomSheet>
  );
}

function NotAReservation() {
  const { t } = useTranslation();
  return <Note icon="information-circle-outline" text={t('classDetail.notAReservation')} />;
}

function Note({ icon, text }: { icon: 'information-circle-outline' | 'globe-outline' | 'notifications-off-outline'; text: string }) {
  return (
    <View style={styles.note}>
      <Icon name={icon} size={16} color={colors.textTertiary} />
      <Text variant="caption" color="tertiary" style={styles.noteText}>
        {text}
      </Text>
    </View>
  );
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
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryMuted,
  },
  statusText: { flex: 1, gap: spacing.xxs },
  illustration: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  illustrationMuted: { backgroundColor: colors.surfaceSecondary },
  note: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  noteText: { flex: 1 },
});
