/**
 * Arena Fit design tokens — the single source of truth for the visual system.
 * Components must read from here; never hardcode colors or sizes in screens.
 *
 * The app is dark-only by design (premium club interface).
 */

export const colors = {
  background: '#0A0A0B',
  surface: '#151517',
  surfaceSecondary: '#1E1E21',
  surfacePressed: '#26262A',

  // Arena Fit logo green (approx. #80B918, supplied by the club). Used for
  // brand moments (membership card, brand marks). The logo file itself is never
  // recolored.
  brand: '#80B918',
  brandMuted: 'rgba(128, 185, 24, 0.16)',

  // Brighter lime for CTAs and active states — reads better on near-black than
  // the logo green at small sizes. Approved alongside the brand green.
  primary: '#C6F432',
  primaryPressed: '#B3DE24',
  onPrimary: '#0A0A0B',
  primaryMuted: 'rgba(198, 244, 50, 0.12)',

  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1A8',
  textTertiary: '#6B6B73',

  success: '#3DDC84',
  warning: '#FFB020',
  error: '#FF5A5F',

  border: '#2A2A2E',
  overlay: 'rgba(0, 0, 0, 0.55)',
  skeleton: '#1C1C1F',
  skeletonHighlight: '#2A2A2E',
} as const;

/** 4pt grid. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

/** Horizontal padding of every screen. */
export const screenGutter = spacing.xl;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

/**
 * Type scale. `display`/`title` are tight and heavy for the sporty hierarchy;
 * body sizes stay ≥ 15 for readability.
 */
export const typography = {
  display: { fontFamily: fontFamily.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  title: { fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  heading: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  subheading: { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodyStrong: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  caption: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  overline: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 1 },
  label: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 18, letterSpacing: 0 },
  tab: { fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 14, letterSpacing: 0.1 },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Minimum touch target (Apple HIG / Material). */
export const hitTarget = 44;

export const motion = {
  pressScale: 0.97,
  duration: { fast: 120, base: 220, slow: 360 },
  stagger: 50,
} as const;

export const theme = {
  colors,
  spacing,
  screenGutter,
  radius,
  fontFamily,
  typography,
  hitTarget,
  motion,
} as const;

export type Theme = typeof theme;
