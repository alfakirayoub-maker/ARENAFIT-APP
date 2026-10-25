import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';

import type { ReceptionScannerProps } from './types';

/**
 * Native camera QR scanner (expo-camera). QR codes only; the raw value goes
 * to `onScan` and is validated there — nothing scanned is ever opened.
 * Camera permission is asked here, in context, never at launch.
 */
export function ReceptionScanner({ active, onScan }: ReceptionScannerProps) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) return <View style={styles.frame} />;

  if (!permission.granted) {
    const blocked = !permission.canAskAgain;
    return (
      <View style={[styles.frame, styles.permission]}>
        <Icon name="camera-outline" size={32} color={colors.textSecondary} />
        <Text variant="heading" style={styles.center}>
          {blocked ? t('guestPass.scan.permissionDeniedTitle') : t('guestPass.scan.permissionTitle')}
        </Text>
        <Text variant="body" color="secondary" style={styles.center}>
          {blocked ? t('guestPass.scan.permissionDeniedBody') : t('guestPass.scan.permissionBody')}
        </Text>
        {blocked ? (
          <Button label={t('guestPass.scan.openSettings')} variant="secondary" onPress={() => Linking.openSettings()} />
        ) : (
          <Button label={t('guestPass.scan.permissionAllow')} icon="camera-outline" onPress={() => requestPermission()} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={active ? (r) => onScan(r.data) : undefined}
      />
      <View style={styles.reticle} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permission: { gap: spacing.md, padding: spacing.xl },
  center: { textAlign: 'center' },
  reticle: {
    width: '62%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: colors.primary,
  },
});
