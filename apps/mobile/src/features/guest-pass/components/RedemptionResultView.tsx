import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { clubWallClock } from '@/lib/club-clock';
import { formatInstantDateLong } from '@/lib/club-time';
import { colors, fontFamily, radius, spacing } from '@/theme';

import type { RedemptionResult } from '../types';

export type ScanOutcome = Exclude<RedemptionResult, { result: 'redeemed' }> | { result: 'network' };

const clock = (iso: string) => clubWallClock(new Date(iso)).time;

/**
 * « PASS VALIDÉ »: full-screen, high-contrast, readable at arm's length by
 * reception staff looking at the guest's phone. A live clock (seconds
 * ticking) and a soft pulse show it is the app running now, not a screenshot.
 */
export function RedemptionSuccess({
  redeemedAt,
  stationName,
  onDone,
}: {
  redeemedAt: string;
  stationName: string | null;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const check = useSharedValue(reduceMotion ? 1 : 0.6);
  const pulse = useSharedValue(0);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (reduceMotion) return;
    check.set(withSpring(1, { damping: 12, stiffness: 160 }));
    pulse.set(withDelay(400, withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false)));
  }, [reduceMotion, check, pulse]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: check.get() }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - pulse.get()),
    transform: [{ scale: 1 + 0.35 * pulse.get() }],
  }));

  const seconds = String(now.getUTCSeconds()).padStart(2, '0');

  return (
    <View
      style={[styles.success, { paddingTop: insets.top + spacing.xl, paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
      accessibilityLiveRegion="assertive">
      <Logo height={36} />
      <View style={styles.successCenter}>
        <View style={styles.checkWrap}>
          <Animated.View style={[styles.ring, ringStyle]} />
          <Animated.View style={[styles.check, checkStyle]}>
            <Icon name="checkmark" size={72} color={colors.onPrimary} />
          </Animated.View>
        </View>
        <Text style={styles.successTitle} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
          {t('guestPass.result.successTitle')}
        </Text>
        <Text variant="title" style={styles.centerText}>
          {t('guestPass.result.successBody')}
        </Text>

        <View style={styles.ticket}>
          <Text variant="overline" color="accent" uppercase>
            {t('guestPass.result.sessionLabel')}
          </Text>
          <Text variant="heading">
            {t('guestPass.result.when', { date: formatInstantDateLong(redeemedAt), time: clock(redeemedAt) })}
          </Text>
          {stationName && (
            <Text variant="body" color="secondary">
              {stationName}
            </Text>
          )}
        </View>

        <View style={styles.live} accessibilityLabel={t('guestPass.result.live')}>
          <View style={styles.liveDot} />
          <Text variant="label" color="secondary">
            {t('guestPass.result.live')} · {clubWallClock(now).time}:{seconds}
          </Text>
        </View>
      </View>
      <Button label={t('guestPass.result.done')} variant="secondary" size="lg" fullWidth onPress={onDone} />
    </View>
  );
}

const failureIcon: Record<ScanOutcome['result'], IconName> = {
  no_pass: 'ticket-outline',
  expired: 'time-outline',
  already_used: 'checkmark-done-outline',
  invalid_qr: 'qr-code-outline',
  station_inactive: 'ban-outline',
  network: 'cloud-offline-outline',
  not_guest: 'person-outline',
};

/** Refusals and errors — always a friendly message, never a raw server error. */
export function RedemptionFailure({ outcome, onRetry, onBack }: { outcome: ScanOutcome; onRetry: () => void; onBack: () => void }) {
  const { t } = useTranslation();
  const key = outcome.result;
  const body =
    outcome.result === 'already_used' && outcome.redeemedAt
      ? t('guestPass.result.states.already_used.body', {
          date: formatInstantDateLong(outcome.redeemedAt),
          time: clock(outcome.redeemedAt),
        })
      : outcome.result === 'already_used'
        ? ''
        : t(`guestPass.result.states.${key}.body`);
  const canRetry = key === 'invalid_qr' || key === 'station_inactive' || key === 'network';

  return (
    <View style={styles.failure} accessibilityLiveRegion="polite">
      <View style={styles.failureIcon}>
        <Icon name={failureIcon[key]} size={34} color={key === 'already_used' ? colors.warning : colors.textSecondary} />
      </View>
      <Text variant="title" accessibilityRole="header" style={styles.centerText}>
        {t(`guestPass.result.states.${key}.title`)}
      </Text>
      {body ? (
        <Text variant="body" color="secondary" style={styles.centerText}>
          {body}
        </Text>
      ) : null}
      <View style={styles.failureActions}>
        {canRetry && <Button label={t('guestPass.result.retry')} icon="scan-outline" size="lg" fullWidth onPress={onRetry} />}
        <Button label={t('guestPass.result.back')} variant={canRetry ? 'ghost' : 'secondary'} fullWidth onPress={onBack} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  success: {
    flex: 1,
    backgroundColor: '#0E1A06',
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  successCenter: { alignItems: 'center', gap: spacing.lg, alignSelf: 'stretch' },
  checkWrap: { width: 168, height: 168, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 168, height: 168, borderRadius: 84, backgroundColor: colors.primary },
  check: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: 1,
    color: colors.primary,
    textAlign: 'center',
  },
  centerText: { textAlign: 'center' },
  ticket: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1,
    borderColor: colors.brandMuted,
  },
  live: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  failure: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl },
  failureIcon: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  failureActions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.lg },
});
