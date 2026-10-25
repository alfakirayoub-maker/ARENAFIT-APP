import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';

/**
 * DEVELOPMENT ONLY (required behind NODE_ENV, excluded from release bundles):
 * injects scans for screenshots and testing. The reception QR payloads come
 * from the git-ignored .env.local written by scripts/local-stack/up.sh.
 */
const validQr = process.env.EXPO_PUBLIC_DEV_RECEPTION_QR;
const inactiveQr = process.env.EXPO_PUBLIC_DEV_RECEPTION_QR_INACTIVE;

export function ScanSimulator({ onScan, disabled }: { onScan: (data: string) => void; disabled: boolean }) {
  const { t } = useTranslation();
  const samples = [
    validQr && { label: t('guestPass.scan.devValid'), value: validQr },
    inactiveQr && { label: t('guestPass.scan.devInactive'), value: inactiveQr },
    { label: t('guestPass.scan.devInvalid'), value: 'AF-NOT-A-RECEPTION-QR' },
    { label: t('guestPass.scan.devUrl'), value: 'https://example.com/promo' },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <View style={styles.root}>
      <Text variant="overline" color="tertiary" uppercase>
        {t('guestPass.scan.devTitle')}
      </Text>
      <View style={styles.buttons}>
        {samples.map((s) => (
          <Button key={s.label} label={s.label} variant="ghost" disabled={disabled} onPress={() => onScan(s.value)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: 'rgba(10, 10, 11, 0.92)',
  },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
