import type { ImageSource } from 'expo-image';

/**
 * Wire the official Arena Fit logo here once the file is in assets/brand/.
 *
 *   export const brandLogo: BrandLogo = {
 *     source: require('@/assets/brand/arena-fit-logo.png'),
 *     aspectRatio: <file width / file height>,
 *   };
 *
 * Kept as `null` until then so the app never ships an imitation logo.
 */
export type BrandLogo = { source: ImageSource | number; aspectRatio: number };

export const brandLogo: BrandLogo | null = null;
