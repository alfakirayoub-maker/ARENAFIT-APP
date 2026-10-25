import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors, fontFamily, radius } from '@/theme';

import { Text } from './Text';

export type AvatarProps = {
  name: string;
  imageUrl?: string | null;
  size?: number;
  /** Lime ring, e.g. for the signed-in member. */
  highlighted?: boolean;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toLocaleUpperCase())
    .join('');
}

/** Photo when available, initials otherwise. Decorative: label the parent. */
export function Avatar({ name, imageUrl, size = 48, highlighted }: AvatarProps) {
  return (
    <View
      accessible={false}
      style={[
        styles.base,
        { width: size, height: size },
        highlighted && { borderWidth: 2, borderColor: colors.primary },
      ]}>
      {imageUrl ? (
        <Image source={imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Text
          style={{ fontFamily: fontFamily.bold, fontSize: size * 0.36, lineHeight: size * 0.44 }}
          color="primary"
          maxFontSizeMultiplier={1}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
