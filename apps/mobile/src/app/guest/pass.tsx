import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DetailScreen } from '@/components/ui/DetailScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useMyGuestPass } from '@/features/guest-pass/hooks';
import { useSession } from '@/features/session/session';
import { clubWallClock } from '@/lib/club-clock';
import { formatInstantDateLong } from '@/lib/club-time';
import { colors, radius, spacing } from '@/theme';

const STEPS: { key: 'reception' | 'open' | 'scan'; icon: IconName }[] = [
  { key: 'reception', icon: 'location-outline' },
  { key: 'open', icon: 'phone-portrait-outline' },
  { key: 'scan', icon: 'qr-code-outline' },
];

/**
 * « Utiliser mon Pass »: how check-in works. The guest never shows a code —
 * they scan the QR displayed at the reception with this phone.
 */
export default function UseGuestPassScreen() {
  const { t } = useTranslation();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  const { session, restored } = useSession();
  const query = useMyGuestPass();
  const pass = query.data;
  const active = pass?.status === 'activated';

  if (restored && session.kind !== 'guest') return <Redirect href="/" />;

  return (
    <DetailScreen
      footer={
        active ? (
          <Button label={t('guestPass.use.scan')} icon="scan-outline" size="lg" fullWidth onPress={() => router.push('/guest/scan')} />
        ) : undefined
      }>
      {welcome === '1' && active && (
        <View style={styles.welcome} accessibilityLiveRegion="polite">
          <Icon name="checkmark-circle" size={22} color={colors.primary} />
          <View style={styles.flex}>
            <Text variant="bodyStrong">{t('guestPass.welcome.title')}</Text>
            <Text variant="caption" color="secondary">
              {t('guestPass.welcome.body')}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.header}>
        <Badge label={t('guestPass.guestMode')} tone="accent" icon="person-outline" />
        <Text variant="display" accessibilityRole="header">
          {active ? t('guestPass.use.title') : t('guestPass.home.title')}
        </Text>
      </View>

      {pass === undefined ? (
        query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : (
          <Skeleton height={320} borderRadius={radius.xl} />
        )
      ) : pass === null ? (
        <EmptyState icon="ticket-outline" title={t('guestPass.use.noneTitle')} body={t('guestPass.use.noneBody')} />
      ) : active ? (
        <>
          <View style={styles.summary}>
            <Icon name="ticket-outline" size={22} color={colors.primary} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{t('guestPass.home.sessions', { count: pass.sessions })}</Text>
              <Text variant="caption" color="secondary">
                {t('guestPass.home.validUntil', { date: formatInstantDateLong(pass.validUntil) })}
              </Text>
            </View>
          </View>
          <View style={styles.steps}>
            {STEPS.map((s, i) => (
              <View key={s.key} style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text variant="label" color="accent">
                    {i + 1}
                  </Text>
                </View>
                <Text variant="subheading" style={styles.flex}>
                  {t(`guestPass.use.steps.${s.key}`)}
                </Text>
                <Icon name={s.icon} size={22} color={colors.textTertiary} />
              </View>
            ))}
          </View>
          {pass.inviterName && (
            <Text variant="caption" color="tertiary">
              {t('guestPass.home.offeredBy', { name: pass.inviterName })}
            </Text>
          )}
        </>
      ) : (
        <View style={styles.inactive}>
          <Icon name={pass.status === 'expired' ? 'time-outline' : 'checkmark-done-outline'} size={32} color={colors.textSecondary} />
          <Text variant="title" style={styles.center}>
            {pass.status === 'expired' ? t('guestPass.result.states.expired.title') : t('guestPass.result.states.already_used.title')}
          </Text>
          <Text variant="body" color="secondary" style={styles.center}>
            {pass.status === 'expired'
              ? t('guestPass.result.states.expired.body')
              : pass.redeemedAt
                ? t('guestPass.result.states.already_used.body', {
                    date: formatInstantDateLong(pass.redeemedAt),
                    time: clubWallClock(new Date(pass.redeemedAt)).time,
                  })
                : t('guestPass.home.used')}
          </Text>
        </View>
      )}
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  welcome: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.primaryMuted },
  flex: { flex: 1, gap: spacing.xxs },
  header: { gap: spacing.sm, alignItems: 'flex-start' },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.brandMuted,
  },
  steps: { gap: spacing.md },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactive: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.surface },
  center: { textAlign: 'center' },
});
