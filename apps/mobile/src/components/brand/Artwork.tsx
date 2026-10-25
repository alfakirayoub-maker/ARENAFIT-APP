import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { colors } from '@/theme';
import type { ActivityCategory } from '@/types/domain';

export const categoryIcons: Record<ActivityCategory, IconName> = {
  fitness: 'barbell-outline',
  combat: 'hand-left-outline',
  dance: 'musical-notes-outline',
  aqua: 'water-outline',
  kids: 'happy-outline',
  cycling: 'bicycle-outline',
  mind_body: 'leaf-outline',
};

// Flat, low-alpha tints: enough to tell categories apart, never loud.
const tints: Record<ActivityCategory, string> = {
  fitness: 'rgba(198, 244, 50, 0.10)',
  combat: 'rgba(255, 90, 95, 0.12)',
  dance: 'rgba(255, 120, 200, 0.10)',
  aqua: 'rgba(70, 170, 255, 0.12)',
  kids: 'rgba(255, 200, 60, 0.12)',
  cycling: 'rgba(255, 150, 40, 0.12)',
  mind_body: 'rgba(80, 220, 190, 0.10)',
};

export type ArtworkProps = {
  /** Real photography when available (admin-uploaded). */
  imageUrl?: string | null;
  /** Drives the fallback when there is no photo yet. */
  category?: ActivityCategory;
  /** Size of the fallback mark. */
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Image slot for activities, sessions and news. Shows the photo when one
 * exists; otherwise a quiet, category-tinted placeholder with a large outlined
 * mark — designed to look intentional until club photography is uploaded.
 */
export function Artwork({ imageUrl, category, iconSize = 120, style }: ArtworkProps) {
  if (imageUrl) {
    return (
      <View style={[styles.base, style]}>
        <Image source={imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} accessible={false} />
      </View>
    );
  }

  return (
    <View style={[styles.base, style]} accessible={false}>
      {category && <View style={[StyleSheet.absoluteFill, { backgroundColor: tints[category] }]} />}
      <View style={[styles.mark, { right: -iconSize * 0.18, top: -iconSize * 0.08 }]}>
        <Icon name={category ? categoryIcons[category] : 'flash-outline'} size={iconSize} color="rgba(255,255,255,0.07)" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surfaceSecondary, overflow: 'hidden' },
  mark: { position: 'absolute' },
});
