/**
 * Color palette for the cinematic, premium dark UI.
 * Primary surface is True Black for battery efficiency on OLED; the single
 * accent is Electric Teal, used for the active recording state, waveform and
 * dynamic progress indicators.
 */
export const colors = {
  /** Primary background — True Black (#000000). */
  background: '#000000',
  /** Slightly elevated surface for cards/sheets. */
  surface: '#0A0A0A',
  surfaceElevated: '#141414',
  /** Accent — Electric Teal (#00F5D4). */
  accent: '#00F5D4',
  accentDim: '#00F5D466',
  /** Text. */
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textTertiary: '#5A5A5A',
  /** State / feedback. */
  recording: '#00F5D4',
  error: '#FF4D6D',
  filtered: '#3A3A3A',
  border: '#1F1F1F',
} as const;

export type ColorToken = keyof typeof colors;
