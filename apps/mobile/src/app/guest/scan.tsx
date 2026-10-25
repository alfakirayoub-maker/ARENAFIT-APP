import { Redirect, router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { RedemptionFailure } from '@/features/guest-pass/components/RedemptionResultView';
import { redeemAndUpdatePass, useMyGuestPass } from '@/features/guest-pass/hooks';
import { ScanController, type ScanPhase } from '@/features/guest-pass/scan-controller';
import { ReceptionScanner } from '@/features/guest-pass/scanner/ReceptionScanner';
import type { RedemptionResult } from '@/features/guest-pass/types';
import { useSession } from '@/features/session/session';
import { haptics } from '@/lib/haptics';
import { colors, radius, screenGutter, spacing } from '@/theme';

/** Development only: injected scans for web review / tests (excluded from release bundles). */
const devSimulator: typeof import('@/dev/ScanSimulator') | null =
  process.env.NODE_ENV !== 'production'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- dev-only module, excluded from release bundles
      (require('@/dev/ScanSimulator') as typeof import('@/dev/ScanSimulator'))
    : null;
const ScanSimulator = devSimulator?.ScanSimulator ?? null;

/**
 * « Scanner le QR »: the guest scans the reception QR; the server redeems the
 * pass of the signed-in guest. Guest Mode with an activated pass only. One
 * recognised QR → one request (ScanController); the result comes from the server.
 */
export default function ScanReceptionScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { session, restored } = useSession();
  const passQuery = useMyGuestPass();
  const queryClient = useQueryClient();
  const [torch, setTorch] = useState(false);
  const [phase, setPhase] = useState<ScanPhase>({ kind: 'scanning', notice: null });

  const [controller] = useState(
    () =>
      new ScanController({
        redeem: (qr) =>
          devSimulator?.takeSimulatedNetworkFailure()
            ? Promise.reject(new Error('simulated network failure'))
            : redeemAndUpdatePass(queryClient, qr),
        onChange: setPhase,
      }),
  );
  useEffect(() => () => controller.dispose(), [controller]);

  const result: RedemptionResult | null = phase.kind === 'done' ? phase.result : null;
  useEffect(() => {
    if (result?.result === 'redeemed') {
      haptics.success();
      // The pass cache holds the server's redemption; back on /guest/pass (no second copy
      // in the stack) the live confirmation shows.
      router.dismissTo('/guest/pass');
    }
  }, [result]);

  if (restored && session.kind !== 'guest') return <Redirect href="/" />;
  if (phase.kind === 'scanning' && passQuery.data !== undefined && passQuery.data?.status !== 'activated') {
    return <Redirect href="/guest/pass" />;
  }

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (result && result.result !== 'redeemed') {
    return (
      <View style={[styles.resultRoot, { paddingTop: insets.top + spacing.xl }]}>
        <RedemptionFailure outcome={result} onRetry={() => controller.rescan()} onBack={close} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ReceptionScanner active={phase.kind === 'scanning'} onScan={(d) => controller.onScan(d)} torch={torch} />

      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View style={styles.topBar} pointerEvents="box-none">
          <IconButton icon="close" accessibilityLabel={t('guestPass.scan.close')} onPress={close} />
          {Platform.OS !== 'web' && (
            <IconButton
              icon={torch ? 'flashlight' : 'flashlight-outline'}
              accessibilityLabel={torch ? t('guestPass.scan.torchOff') : t('guestPass.scan.torchOn')}
              active={torch}
              onPress={() => setTorch((v) => !v)}
            />
          )}
        </View>
        <Text variant="title" style={styles.center}>
          {t('guestPass.scan.title')}
        </Text>
        <Text variant="body" color="secondary" style={styles.center}>
          {t('guestPass.scan.hint')}
        </Text>
      </View>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]} pointerEvents="box-none">
        {phase.kind === 'scanning' && phase.notice === 'unrecognized' && (
          <View style={styles.notice} accessibilityLiveRegion="polite">
            <Icon name="alert-circle-outline" size={22} color={colors.warning} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{t('guestPass.scan.unrecognizedTitle')}</Text>
              <Text variant="caption" color="secondary">
                {t('guestPass.scan.unrecognizedBody')}
              </Text>
            </View>
          </View>
        )}

        {phase.kind === 'validating' && (
          <View style={styles.notice} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.primary} />
            <Text variant="bodyStrong">{t('guestPass.scan.checking')}</Text>
          </View>
        )}

        {phase.kind === 'network_error' && (
          <View style={styles.panel} accessibilityLiveRegion="assertive">
            <View style={styles.panelHead}>
              <Icon name="cloud-offline-outline" size={24} color={colors.textSecondary} />
              <View style={styles.flex}>
                <Text variant="bodyStrong">{t('guestPass.scan.networkTitle')}</Text>
                <Text variant="caption" color="secondary">
                  {t('guestPass.scan.networkBody')}
                </Text>
              </View>
            </View>
            <Button label={t('guestPass.scan.retry')} icon="refresh" fullWidth onPress={() => controller.retry()} />
            <Button label={t('guestPass.scan.cancel')} variant="ghost" fullWidth onPress={() => controller.rescan()} />
          </View>
        )}

        {ScanSimulator && phase.kind !== 'network_error' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sim}>
            <ScanSimulator onScan={(d) => controller.onScan(d)} disabled={phase.kind !== 'scanning'} />
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  resultRoot: { flex: 1, backgroundColor: colors.background, paddingHorizontal: screenGutter },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: screenGutter, gap: spacing.xs },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  center: { textAlign: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: screenGutter, gap: spacing.md },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(21, 21, 23, 0.94)',
  },
  panel: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: 'rgba(21, 21, 23, 0.97)' },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs },
  flex: { flex: 1, gap: spacing.xxs },
  sim: { flexGrow: 1 },
});
