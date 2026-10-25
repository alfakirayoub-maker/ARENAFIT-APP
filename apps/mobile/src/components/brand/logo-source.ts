import type { ImageSource } from 'expo-image';

/**
 * The official Arena Fit logo, exactly as supplied (assets/brand/arena-fit-logo.png,
 * 1080×639, white artwork with #80B918 accents on transparency — made for dark
 * backgrounds). Never recolored, redrawn or re-proportioned: rendered with
 * contentFit="contain" at its native aspect ratio.
 */
export type BrandLogo = { source: ImageSource | number; aspectRatio: number };

export const brandLogo: BrandLogo = {
  source: require('@/assets/brand/arena-fit-logo.png'),
  aspectRatio: 1080 / 639,
};
