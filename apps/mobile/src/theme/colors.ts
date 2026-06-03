/**
 * Color palette for the cinematic, premium dark UI.
 * Primary surface is True Black for battery efficiency on OLED; the single
 * accent is Electric Teal, used for the active recording state, waveform and
 * dynamic progress indicators.
 */
export const colors = {
  /** Primary background — True Black (#000000). */
  background: '#000000',
  /** Slightly elevated surfaces for cards/sheets. */
  surface: '#0B0C0E',
  surfaceElevated: '#141619',
  surfaceHover: '#1B1E22',

  /** Accent — Electric Teal (#00F5D4) and supporting tints. */
  accent: '#00F5D4',
  accentBright: '#5DFFE6',
  accentDim: 'rgba(0, 245, 212, 0.55)',
  accentSoft: 'rgba(0, 245, 212, 0.14)',
  accentFaint: 'rgba(0, 245, 212, 0.06)',
  accentGlow: 'rgba(0, 245, 212, 0.35)',

  /** Text. */
  textPrimary: '#FFFFFF',
  textSecondary: '#9BA1A8',
  textTertiary: '#5A5F66',

  /** State / feedback. */
  recording: '#00F5D4',
  error: '#FF4D6D',
  success: '#3DDC97',
  warning: '#FFB454',
  filtered: '#2A2D31',

  /** Language badges. */
  badgeHe: 'rgba(0, 245, 212, 0.16)',
  badgeEn: 'rgba(124, 156, 255, 0.16)',
  badgeHeText: '#00F5D4',
  badgeEnText: '#A9BEFF',

  /** Lines & overlays. */
  border: '#1E2125',
  borderStrong: '#2C3036',
  overlay: 'rgba(0, 0, 0, 0.6)',
} as const;

export type ColorToken = keyof typeof colors;
