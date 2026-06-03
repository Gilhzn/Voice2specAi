/**
 * Central design-token export. Combines color, typography, spacing, radii,
 * motion timings and elevation into a single theme object consumed across the
 * app.
 */
import { colors } from './colors';
import { typography, fontFamilies, fontFamilyForLanguage } from './typography';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

/** Motion timings tuned for fluid 60fps transitions. */
export const motion = {
  /** Frames-per-second target for organic waveform animation. */
  targetFps: 60,
  fast: 150,
  base: 250,
  slow: 400,
  /** Per-character delay for the soft typewriter transcript reveal (ms). */
  typewriterCharMs: 16,
} as const;

/** Reusable shadow / glow presets (iOS shadow + Android elevation). */
export const elevation = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  glow: {
    shadowColor: colors.accent,
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
} as const;

export const theme = {
  colors,
  typography,
  fontFamilies,
  fontFamilyForLanguage,
  spacing,
  radii,
  motion,
  elevation,
} as const;

export type Theme = typeof theme;
export { colors, typography, fontFamilies, fontFamilyForLanguage };
