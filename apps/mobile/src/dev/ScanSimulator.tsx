import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';

/**
 * DEVELOPMENT ONLY (required behind NODE_ENV in guest/scan.tsx, excluded from
 * release bundles — verified by scripts/check-release-bundle.sh). Injects
 * scans for web review and tests. Labels live here, not in the app's
 * translations, so release bundles carry no trace of the simulator.
 * Station payloads come from the git-ignored .env.local written by
 * scripts/local-stack/up.sh.
 */
const validQr = process.env.EXPO_PUBLIC_DEV_RECEPTION_QR;
const inactiveQr = process.env.EXPO_PUBLIC_DEV_RECEPTION_QR_INACTIVE;

let failNextRequest = false;

/** True once after « Réseau coupé » was used: the next redemption request fails like an offline phone. */
export function takeSimulatedNetworkFailure(): boolean {
  const fail = failNextRequest;
  failNextRequest = false;
  return fail;
}

export function ScanSimulator({ onScan, disabled }: { onScan: (data: string) => void; disabled: boolean }) {
  const samples = [
    validQr && { label: 'QR réception valide', run: () => onScan(validQr) },
    inactiveQr && { label: 'QR réception désactivé', run: () => onScan(inactiveQr) },
    validQr && {
      label: 'Réseau coupé (QR valide)',
      run: () => {
        failNextRequest = true;
        onScan(validQr);
      },
    },
    { label: 'QR station inconnue', run: () => onScan(`AFR1.${'Z'.repeat(43)}`) },
    { label: 'QR non Arena Fit', run: () => onScan('AF-NOT-A-RECEPTION-QR') },
    { label: 'Lien quelconque', run: () => onScan('https://example.com/promo') },
  ].filter(Boolean) as { label: string; run: () => void }[];

  return (
    <View style={styles.root}>
      <Text variant="overline" color="tertiary" uppercase>
        Simulation scanner (dev)
      </Text>
      <View style={styles.buttons}>
        {samples.map((s) => (
          <Button key={s.label} label={s.label} variant="ghost" disabled={disabled} onPress={s.run} />
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
