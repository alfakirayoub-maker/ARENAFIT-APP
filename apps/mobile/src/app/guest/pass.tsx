import { Redirect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Logo } from '@/components/brand/Logo';
import { Badge } from '@/components/ui/Badge';
import { DetailScreen } from '@/components/ui/DetailScreen';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useGuestPassQr, useMyGuestPass } from '@/features/guest-pass/hooks';
import { useSession } from '@/features/session/session';
import { formatInstantDateLong } from '@/lib/club-time';
import { colors, radius, spacing } from '@/theme';

const QR_SIZE = 220;

/**
 * Mon Pass Invité: the QR the reception scans (Sprint 6). The QR holds an
 * opaque redemption token only — no name, no ids.
 */
export default function GuestPassScreen() {
  const { t } = useTranslation();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  const { session, restored } = useSession();
  const passQuery = useMyGuestPass();
  const pass = passQuery.data;
  const active = pass?.status === 'activated';
  const qr = useGuestPassQr(active);

  if (restored && session.kind !== 'guest') return <Redirect href="/" />;

  return (
    <DetailScreen>
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
          {t('guestPass.qr.title')}
        </Text>
      </View>

      {pass === undefined ? (
        passQuery.isError ? (
          <ErrorState onRetry={() => passQuery.refetch()} />
        ) : (
          <Skeleton height={420} borderRadius={radius.xl} />
        )
      ) : pass === null ? (
        <ErrorState onRetry={() => passQuery.refetch()} />
      ) : (
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Logo height={30} />
            <Text variant="label" color="secondary">
              {t('guestPass.invite.sessions', { count: pass.sessions })}
            </Text>
          </View>

          {active ? (
            <View style={styles.qrFrame} accessible accessibilityRole="image" accessibilityLabel={t('guestPass.qr.a11y')}>
              {qr.data ? (
                <QRCode value={qr.data} size={QR_SIZE} color="#000000" backgroundColor="#FFFFFF" quietZone={12} ecl="M" />
              ) : qr.isError ? (
                <View style={styles.qrPlaceholder}>
                  <Text variant="caption" style={styles.dark}>
                    {t('guestPass.qr.unavailable')}
                  </Text>
                </View>
              ) : (
                <View style={styles.qrPlaceholder} />
              )}
            </View>
          ) : (
            <View style={styles.inactive}>
              <Icon name={pass.status === 'used' ? 'checkmark-done-outline' : 'time-outline'} size={30} color={colors.textSecondary} />
              <Text variant="title">{pass.status === 'used' ? t('guestPass.qr.usedTitle') : t('guestPass.qr.expiredTitle')}</Text>
              <Text variant="body" color="secondary" style={styles.center}>
                {t('guestPass.qr.inactiveBody')}
              </Text>
            </View>
          )}

          {active && (
            <Text variant="bodyStrong" style={styles.center}>
              {t('guestPass.qr.instruction')}
            </Text>
          )}

          <View style={styles.divider} />
          <View style={styles.facts}>
            <Text variant="body" color="secondary">
              {t('guestPass.home.validUntil', { date: formatInstantDateLong(pass.validUntil) })}
            </Text>
            {pass.inviterName && (
              <Text variant="body" color="secondary">
                {t('guestPass.home.offeredBy', { name: pass.inviterName })}
              </Text>
            )}
          </View>
        </View>
      )}

      {active && (
        <Text variant="caption" color="tertiary" style={styles.center}>
          {t('guestPass.qr.personal')}
        </Text>
      )}
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  welcome: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryMuted,
  },
  flex: { flex: 1, gap: spacing.xxs },
  header: { gap: spacing.sm, alignItems: 'flex-start' },
  card: {
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.brandMuted,
    alignItems: 'center',
  },
  cardTop: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qrFrame: { padding: spacing.sm, borderRadius: radius.lg, backgroundColor: '#FFFFFF' },
  qrPlaceholder: {
    width: QR_SIZE + 24,
    height: QR_SIZE + 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dark: { color: '#0A0A0B' },
  inactive: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  center: { textAlign: 'center' },
  divider: { alignSelf: 'stretch', height: 1, backgroundColor: colors.border },
  facts: { alignSelf: 'stretch', gap: spacing.xs },
});
