import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, fontFamily, radius, spacing } from '@/theme';

/** The short fallback code, for when the invitation link can't be opened. */
export function FallbackCode({ code }: { code: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <Text variant="bodyStrong">{t('guestPass.created.codeTitle')}</Text>
      <Text
        style={styles.code}
        selectable
        accessibilityLabel={`${t('guestPass.created.codeTitle')}: ${code.split('').join(' ')}`}
        maxFontSizeMultiplier={1.3}>
        {code}
      </Text>
      <Text variant="caption" color="secondary">
        {t('guestPass.created.codeBody')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  code: { fontFamily: fontFamily.bold, fontSize: 24, lineHeight: 30, letterSpacing: 2, color: colors.textPrimary },
});
