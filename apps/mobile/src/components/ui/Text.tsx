import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, typography, type TypographyVariant } from '@/theme';

type TextColor = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'onAccent' | 'error';

const colorMap: Record<TextColor, string> = {
  primary: colors.textPrimary,
  secondary: colors.textSecondary,
  tertiary: colors.textTertiary,
  accent: colors.primary,
  onAccent: colors.onPrimary,
  error: colors.error,
};

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: TextColor;
  align?: 'left' | 'center' | 'right';
  uppercase?: boolean;
};

/**
 * The only text primitive screens should use. Supports dynamic type with a cap
 * so large accessibility sizes stay legible without breaking layouts.
 */
export function Text({
  variant = 'body',
  color = 'primary',
  align,
  uppercase,
  style,
  maxFontSizeMultiplier = 1.5,
  ...rest
}: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        typography[variant],
        { color: colorMap[color] },
        align && { textAlign: align },
        uppercase && { textTransform: 'uppercase' },
        style,
      ]}
      {...rest}
    />
  );
}
