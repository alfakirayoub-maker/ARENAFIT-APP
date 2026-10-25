import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { DetailScreen } from '@/components/ui/DetailScreen';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';

const faq = [
  ['reminderQ', 'reminderA'],
  ['guestQ', 'guestA'],
  ['planningQ', 'planningA'],
] as const;

export default function HelpScreen() {
  const { t } = useTranslation();

  return (
    <DetailScreen>
      <Text variant="display" accessibilityRole="header">
        {t('help.title')}
      </Text>
      <View style={styles.list}>
        {faq.map(([q, a]) => (
          <View key={q} style={styles.item}>
            <Text variant="subheading">{t(`help.faq.${q}`)}</Text>
            <Text variant="body" color="secondary">
              {t(`help.faq.${a}`)}
            </Text>
          </View>
        ))}
      </View>
      <Text variant="body" color="tertiary">
        {t('help.contact')}
      </Text>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  item: { gap: spacing.xs, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.surface },
});
