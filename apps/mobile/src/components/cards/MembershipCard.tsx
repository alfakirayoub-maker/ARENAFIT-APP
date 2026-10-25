import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Logo } from '@/components/brand/Logo';
import { Badge } from '@/components/ui/Badge';
import { Text } from '@/components/ui/Text';
import { formatDateShort } from '@/lib/club-time';
import { colors, radius, spacing } from '@/theme';
import type { Membership } from '@/types/domain';

const statusTone = { active: 'success', expired: 'error', suspended: 'warning' } as const;

/**
 * Membership summary ("Arena Premium · Valide jusqu’au 24/08/2027").
 * Informational only: it is not an access card and shows no QR code.
 */
export function MembershipCard({ membership, holderName }: { membership: Membership; holderName: string }) {
  const { t } = useTranslation();

  return (
    <View style={styles.card} accessible accessibilityLabel={`${membership.planName}, ${holderName}`}>
      <View style={styles.stripe} />
      <View style={styles.top}>
        <Logo height={34} />
        <Badge label={t(`profile.membershipStatus.${membership.status}`)} tone={statusTone[membership.status]} />
      </View>
      <View style={styles.bottom}>
        <Text variant="title">{membership.planName}</Text>
        <Text variant="body" color="secondary">
          {holderName}
        </Text>
        {membership.endsOn && (
          <Text variant="caption" color="secondary" style={styles.validity}>
            {t('profile.validUntil', { date: formatDateShort(membership.endsOn) })}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.xxl,
    overflow: 'hidden',
  },
  // Brand green accent: the logo colour, used sparingly.
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.brand },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottom: { gap: spacing.xxs },
  validity: { marginTop: spacing.sm },
});
