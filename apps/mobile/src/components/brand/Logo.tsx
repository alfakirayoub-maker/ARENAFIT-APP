import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';

import { brandLogo } from './logo-source';

export type LogoProps = {
  /** Rendered height; width follows the file's own aspect ratio. */
  height?: number;
};

/**
 * Official Arena Fit logo (white + brand green, for dark backgrounds). The file
 * is never redrawn, recolored or reshaped in code: `contentFit="contain"` at
 * its native aspect ratio.
 */
export function Logo({ height = 40 }: LogoProps) {
  const { t } = useTranslation();
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
