import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';

import type { ReceptionScannerProps } from './types';

/**
 * Web preview only: no camera. The viewfinder is drawn for UX review; scans
 * are injected by the development simulator. Not proof the native scanner works.
 */
export function ReceptionScanner(_props: ReceptionScannerProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.frame}>
      <View style={styles.reticle}>
        <Icon name="qr-code-outline" size={56} color={colors.textTertiary} />
      </View>
      <View style={styles.caption}>
        <Text variant="label" color="secondary">
          {t('guestPass.scan.webTitle')}
        </Text>
        <Text variant="caption" color="tertiary" style={styles.center}>
          {t('guestPass.scan.webBody')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.xl,
    backgroundColor: '#050506',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  reticle: {
    width: '58%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: { alignItems: 'center', gap: spacing.xxs },
  center: { textAlign: 'center' },
});
