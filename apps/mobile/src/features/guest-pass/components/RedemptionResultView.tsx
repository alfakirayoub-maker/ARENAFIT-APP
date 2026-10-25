import { useEffect } from 'react';
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
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { clubWallClock } from '@/lib/club-clock';
import { formatInstantDateLong } from '@/lib/club-time';
import { colors, fontFamily, radius, spacing } from '@/theme';

import type { RedemptionResult } from '../types';

export type ScanOutcome = Exclude<RedemptionResult, { result: 'redeemed' }>;

const hhmm = (d: Date) => clubWallClock(d).time;
const hhmmss = (d: Date) => `${clubWallClock(d).time}:${String(d.getUTCSeconds()).padStart(2, '0')}`;

/**
 * Live « PASS VALIDÉ » — only shown inside the server's confirmation window
 * (the caller decides with server time). Distinct from a screenshot through
 * the server-aligned ticking clock, « Validé maintenant » and a soft pulse;
 * the real control remains the one-use redemption on the server.
 */
export function LiveConfirmation({
  redeemedAt,
  stationName,
  serverNow,
  onDone,
}: {
  redeemedAt: string;
  stationName: string | null;
  serverNow: Date;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const check = useSharedValue(reduceMotion ? 1 : 0.6);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    check.set(withSpring(1, { damping: 12, stiffness: 160 }));
    pulse.set(withDelay(400, withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false)));
  }, [reduceMotion, check, pulse]);

  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: check.get() }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - pulse.get()),
    transform: [{ scale: 1 + 0.35 * pulse.get() }],
  }));

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
          <Badge label={t('guestPass.result.validatedNow')} tone="success" icon="radio-button-on" />
          <Text variant="overline" color="accent" uppercase>
            {t('guestPass.result.sessionLabel')}
          </Text>
          <Text variant="heading">{t('guestPass.result.validatedAt', { time: hhmm(new Date(redeemedAt)) })}</Text>
          {stationName && (
            <Text variant="body" color="secondary">
              {stationName}
            </Text>
          )}
        </View>

        <View style={styles.live} accessible accessibilityLabel={`${t('guestPass.result.live')} ${hhmmss(serverNow)}`}>
          <View style={styles.liveDot} />
          <Text variant="label" color="secondary">
            {formatInstantDateLong(serverNow.toISOString())}
          </Text>
          <Text style={styles.liveClock} maxFontSizeMultiplier={1.2}>
            {hhmmss(serverNow)}
          </Text>
        </View>
      </View>
      <Button label={t('guestPass.result.done')} variant="secondary" size="lg" fullWidth onPress={onDone} />
    </View>
  );
}

/** After the window: calm « PASS UTILISÉ » with the server redemption time. Never green. */
export function UsedConfirmation({
  redeemedAt,
  stationName,
  serverNow,
}: {
  redeemedAt: string | null;
  stationName: string | null;
  serverNow: Date;
}) {
  const { t } = useTranslation();
  const when = redeemedAt ? new Date(redeemedAt) : null;
  const sameDay = when && clubWallClock(when).date === clubWallClock(serverNow).date;
  return (
    <View style={styles.used} accessible>
      <Icon name="checkmark-done-outline" size={32} color={colors.textSecondary} />
      <Text style={styles.usedTitle} accessibilityRole="header">
        {t('guestPass.result.usedTitle')}
      </Text>
      {when && (
        <Text variant="body" color="secondary" style={styles.centerText}>
          {sameDay
            ? t('guestPass.result.usedToday', { time: hhmm(when) })
            : t('guestPass.result.usedOn', { date: formatInstantDateLong(when.toISOString()), time: hhmm(when) })}
        </Text>
      )}
      {stationName && (
        <Text variant="caption" color="tertiary">
          {stationName}
        </Text>
      )}
    </View>
  );
}

const failureIcon: Record<ScanOutcome['result'], IconName> = {
  no_pass: 'ticket-outline',
  expired: 'time-outline',
  already_used: 'checkmark-done-outline',
  invalid_qr: 'qr-code-outline',
  station_inactive: 'ban-outline',
  not_guest: 'person-outline',
};

/** Server refusals — always a friendly message, never a raw server error. */
export function RedemptionFailure({ outcome, onRetry, onBack }: { outcome: ScanOutcome; onRetry: () => void; onBack: () => void }) {
  const { t } = useTranslation();
  const key = outcome.result;
  const body =
    outcome.result === 'already_used'
      ? outcome.redeemedAt
        ? t('guestPass.result.states.already_used.body', {
            date: formatInstantDateLong(outcome.redeemedAt),
            time: hhmm(new Date(outcome.redeemedAt)),
          })
        : ''
      : t(`guestPass.result.states.${key}.body`);
  const canRetry = key === 'invalid_qr' || key === 'station_inactive';

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
      {outcome.result === 'already_used' && outcome.stationName ? (
        <Text variant="caption" color="tertiary">
          {outcome.stationName}
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
  checkWrap: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: colors.primary },
  check: {
    width: 120,
    height: 120,
    borderRadius: 60,
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
  live: { alignItems: 'center', gap: spacing.xxs },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveClock: { fontFamily: fontFamily.bold, fontSize: 30, lineHeight: 36, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  used: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.surface },
  usedTitle: { fontFamily: fontFamily.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: 0.5, color: colors.textPrimary },
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
