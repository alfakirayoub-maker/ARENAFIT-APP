import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { formatInstantDateLong } from '@/lib/club-time';
import { colors, radius, spacing } from '@/theme';

import { useMyGuestPass } from '../hooks';

/** Guest Mode, top of Accueil: the guest's pass, then the normal home content. */
export function GuestPassHomeCard() {
  const { t } = useTranslation();
  const { data: pass, isError } = useMyGuestPass();

  if (pass === undefined) return isError ? null : <Skeleton height={168} borderRadius={radius.xl} />;
  if (pass === null) return null;

  const active = pass.status === 'activated';
  return (
    <View style={[styles.card, !active && styles.inactive]}>
      <View style={styles.row}>
        <View style={styles.mark}>
          <Icon name="ticket-outline" size={22} color={active ? colors.onPrimary : colors.textSecondary} />
        </View>
        <View style={styles.texts}>
          <Text variant="overline" color={active ? 'accent' : 'tertiary'} uppercase>
            {t('guestPass.home.title')}
          </Text>
          <Text variant="heading">
            {active
              ? t('guestPass.invite.sessions', { count: pass.sessions })
              : pass.status === 'used'
                ? t('guestPass.home.used')
                : t('guestPass.home.expired')}
          </Text>
          {active && (
            <Text variant="caption" color="secondary">
              {t('guestPass.home.validUntil', { date: formatInstantDateLong(pass.validUntil) })}
            </Text>
          )}
        </View>
      </View>
      {active && <Button label={t('guestPass.home.show')} icon="qr-code-outline" fullWidth onPress={() => router.push('/guest/pass')} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.brandMuted,
  },
  inactive: { borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  mark: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: spacing.xxs },
});
