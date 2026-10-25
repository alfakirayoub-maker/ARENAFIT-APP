import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { DetailScreen } from '@/components/ui/DetailScreen';
import { Text } from '@/components/ui/Text';
import { RedemptionFailure, RedemptionSuccess, type ScanOutcome } from '@/features/guest-pass/components/RedemptionResultView';
import { useMyGuestPass, useRedeemGuestPass } from '@/features/guest-pass/hooks';
import { parseReceptionQr } from '@/features/guest-pass/links';
import { ReceptionScanner } from '@/features/guest-pass/scanner/ReceptionScanner';
import { useSession } from '@/features/session/session';
import { haptics } from '@/lib/haptics';
import { colors, spacing } from '@/theme';

type ScanSimulatorType = typeof import('@/dev/ScanSimulator').ScanSimulator;
/** Development only: injected scans for web review / tests (excluded from release bundles). */
const ScanSimulator: ScanSimulatorType | null =
  process.env.NODE_ENV !== 'production'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- dev-only module, excluded from release bundles
      (require('@/dev/ScanSimulator') as typeof import('@/dev/ScanSimulator')).ScanSimulator
    : null;

type State =
  | { kind: 'scanning' }
  | { kind: 'checking' }
  | { kind: 'success'; redeemedAt: string; stationName: string | null }
  | { kind: 'failure'; outcome: ScanOutcome };

/**
 * « Scanner le QR »: the guest scans the reception QR; the server redeems the
 * pass of the signed-in guest. Guest Mode with an activated pass only.
 */
export default function ScanReceptionScreen() {
  const { t } = useTranslation();
  const { session, restored } = useSession();
  const passQuery = useMyGuestPass();
  const redeem = useRedeemGuestPass();
  const [state, setState] = useState<State>({ kind: 'scanning' });

  if (restored && session.kind !== 'guest') return <Redirect href="/" />;
  // Only an activated pass can be redeemed (a result screen stays visible after redemption).
  if (state.kind === 'scanning' && passQuery.data !== undefined && passQuery.data?.status !== 'activated') {
    return <Redirect href="/guest/pass" />;
  }

  const onScan = (data: string) => {
    if (state.kind !== 'scanning') return;
    const qr = parseReceptionQr(data);
    if (!qr) {
      // Not an Arena Fit reception QR (URL, invitation link, random code): rejected
      // locally, never opened, nothing sent.
      setState({ kind: 'failure', outcome: { result: 'invalid_qr' } });
      return;
    }
    setState({ kind: 'checking' });
    redeem.mutate(qr, {
      onSuccess: (r) => {
        if (r.result === 'redeemed') {
          haptics.success();
          setState({ kind: 'success', redeemedAt: r.redeemedAt, stationName: r.stationName });
        } else {
          setState({ kind: 'failure', outcome: r });
        }
      },
      onError: () => setState({ kind: 'failure', outcome: { result: 'network' } }),
    });
  };

  if (state.kind === 'success') {
    return <RedemptionSuccess redeemedAt={state.redeemedAt} stationName={state.stationName} onDone={() => router.replace('/')} />;
  }

  return (
    <DetailScreen>
      {state.kind === 'failure' ? (
        <RedemptionFailure
          outcome={state.outcome}
          onRetry={() => setState({ kind: 'scanning' })}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      ) : (
        <>
          <View style={styles.header}>
            <Text variant="display" accessibilityRole="header">
              {t('guestPass.scan.title')}
            </Text>
            <Text variant="body" color="secondary">
              {t('guestPass.scan.hint')}
            </Text>
          </View>
          <View>
            <ReceptionScanner active={state.kind === 'scanning'} onScan={onScan} />
            {state.kind === 'checking' && (
              <View style={styles.checking} accessibilityLiveRegion="polite">
                <ActivityIndicator color={colors.primary} size="large" />
                <Text variant="bodyStrong">{t('guestPass.scan.checking')}</Text>
              </View>
            )}
          </View>
          {ScanSimulator && <ScanSimulator onScan={onScan} disabled={state.kind !== 'scanning'} />}
        </>
      )}
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  checking: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 10, 11, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    borderRadius: 24,
  },
});
