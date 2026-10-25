import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';

import { brandLogo } from './logo-source';

export type LogoProps = {
  /** Rendered height; width follows the file's own aspect ratio. */
  height?: number;
};

/**
 * Official Arena Fit logo. The file is never redrawn or reshaped in code: it is
 * rendered with `contentFit="contain"` at its native aspect ratio.
 *
 * Until the official file is added (see assets/brand/README.md) a neutral,
 * clearly-temporary placeholder is shown instead of an imitation.
 */
export function Logo({ height = 28 }: LogoProps) {
  const { t } = useTranslation();

  if (brandLogo) {
    return (
      <Image
        source={brandLogo.source}
        style={{ height, aspectRatio: brandLogo.aspectRatio }}
        contentFit="contain"
        accessibilityLabel={t('a11y.logo')}
        accessibilityRole="image"
      />
    );
  }

  return (
    <View style={[styles.placeholder, { height }]} accessibilityLabel={t('a11y.logo')} accessibilityRole="image">
      <Text variant="overline" color="secondary">
        LOGO
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderColor: colors.textTertiary,
  },
});
