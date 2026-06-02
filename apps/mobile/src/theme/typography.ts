/**
 * Typography tokens. Rubik is used for Hebrew, Inter for English — both modern
 * sans-serifs tuned for legibility on small screens. The correct family is
 * chosen at render time based on the detected segment language.
 */
import { Language } from '@voice2spec/shared-types';

export const fontFamilies = {
  hebrew: 'Rubik',
  english: 'Inter',
} as const;

/** Pick the font family that matches a segment's language. */
export function fontFamilyForLanguage(lang: Language): string {
  return lang === Language.Hebrew ? fontFamilies.hebrew : fontFamilies.english;
}

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '600' as const, letterSpacing: -0.3 },
  body: { fontSize: 17, lineHeight: 26, fontWeight: '400' as const, letterSpacing: 0.1 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const, letterSpacing: 0.2 },
  button: { fontSize: 18, lineHeight: 22, fontWeight: '600' as const, letterSpacing: 0.4 },
} as const;
