import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { spacing } from '@/theme';

import { ScanFrame } from './ScanFrame';
import type { ReceptionScannerProps } from './types';

/**
 * Web preview only: no camera. The viewfinder is drawn for UX review; scans
 * are injected by the development simulator. Not proof the native scanner works.
 */
export function ReceptionScanner({ active }: ReceptionScannerProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.fill}>
      <ScanFrame dimmed={!active} />
      <View style={styles.caption} pointerEvents="none">
        <Text variant="caption" color="tertiary" style={styles.center}>
          {t('guestPass.scan.webTitle')} · {t('guestPass.scan.webBody')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, backgroundColor: '#101012' },
  caption: { position: 'absolute', left: spacing.xl, right: spacing.xl, top: '68%' },
  center: { textAlign: 'center' },
});
