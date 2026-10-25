import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';

/**
 * Compact, deliberately secondary entry point to Guest Passes on Accueil.
 * Visually lighter than the planning content above it.
 */
export function GuestPassCard({ available }: { available: number }) {
  const { t } = useTranslation();
  const title = t('guestPass.cardTitle', { count: available });

  return (
    <PressableScale
      onPress={() => router.push('/pass')}
      scaleTo={0.98}
      accessibilityLabel={`${title}. ${t('guestPass.cardBody')}`}
      accessibilityHint={t('guestPass.offer')}
      style={styles.card}>
      <View style={styles.icon}>
        <Text variant="subheading" accessible={false}>
          🎁
        </Text>
      </View>
      <View style={styles.text}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color="secondary" numberOfLines={2}>
          {t('guestPass.cardBody')}
        </Text>
      </View>
      <View style={styles.cta}>
        <Text variant="label" color="accent">
          {t('guestPass.offer')}
        </Text>
        <Icon name="chevron-forward" size={16} color={colors.primary} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: spacing.xxs },
  cta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
});
