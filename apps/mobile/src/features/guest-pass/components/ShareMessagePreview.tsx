import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Logo } from '@/components/brand/Logo';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';

/** How the invitation will look in WhatsApp / Messages: text bubble + link card. */
export function ShareMessagePreview({ message, url }: { message: string; url: string }) {
  const { t } = useTranslation();
  const text = message.replace(url, '').trimEnd();
  return (
    <View style={styles.root} accessible accessibilityLabel={`${t('guestPass.created.preview')}. ${message}`}>
      <Text variant="overline" color="tertiary" uppercase>
        {t('guestPass.created.preview')}
      </Text>
      <View style={styles.bubble}>
        <View style={styles.linkCard}>
          <View style={styles.logo}>
            <Logo height={26} />
          </View>
          <Text variant="caption" color="secondary" numberOfLines={1}>
            {t('guestPass.invite.gift')}
          </Text>
        </View>
        <Text variant="body">{text}</Text>
        <Text variant="caption" color="accent" numberOfLines={2} selectable>
          {url}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  bubble: {
    alignSelf: 'flex-end',
    maxWidth: '92%',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderBottomRightRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.sm,
  },
  linkCard: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.brand,
  },
  logo: { alignItems: 'flex-start' },
});
