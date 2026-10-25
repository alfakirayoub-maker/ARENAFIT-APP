import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/theme';

import { cameraAccess } from '../scan-controller';
import { ScanFrame } from './ScanFrame';
import type { ReceptionScannerProps } from './types';

/**
 * Native camera QR scanner (expo-camera), filling its parent. QR only.
 * Permission: explained and asked once on demand (never at launch); after a
 * denial we never ask again — « Ouvrir les réglages » instead — and re-check
 * when the app returns to the foreground (the user may have changed it).
 */
export function ReceptionScanner({ active, onScan, torch }: ReceptionScannerProps) {
  const { t } = useTranslation();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const access = cameraAccess(permission);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void getPermission();
    });
    return () => sub.remove();
  }, [getPermission]);

  if (access === 'checking') return <View style={styles.fill} />;

  if (access !== 'granted') {
    const denied = access === 'denied';
    return (
      <View style={[styles.fill, styles.permission]}>
        <Icon name="camera-outline" size={36} color={colors.textSecondary} />
        <Text variant="heading" style={styles.center}>
          {denied ? t('guestPass.scan.permissionDeniedTitle') : t('guestPass.scan.permissionTitle')}
        </Text>
        <Text variant="body" color="secondary" style={styles.center}>
          {denied ? t('guestPass.scan.permissionDeniedBody') : t('guestPass.scan.permissionBody')}
        </Text>
        {denied ? (
          <Button label={t('guestPass.scan.openSettings')} variant="secondary" onPress={() => Linking.openSettings()} />
        ) : (
          <Button label={t('guestPass.scan.permissionAllow')} icon="camera-outline" onPress={() => requestPermission()} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={active ? (r) => onScan(r.data) : undefined}
      />
      <ScanFrame dimmed={!active} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, backgroundColor: '#000000' },
  permission: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xxl },
  center: { textAlign: 'center' },
});
