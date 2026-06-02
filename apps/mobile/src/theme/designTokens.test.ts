import { Language } from '@voice2spec/shared-types';
import { colors, fontFamilyForLanguage, fontFamilies, motion, theme } from './designTokens';

describe('design tokens', () => {
  it('uses True Black and Electric Teal', () => {
    expect(colors.background).toBe('#000000');
    expect(colors.accent).toBe('#00F5D4');
  });

  it('targets 60fps motion', () => {
    expect(motion.targetFps).toBe(60);
  });

  it('maps languages to their fonts', () => {
    expect(fontFamilyForLanguage(Language.Hebrew)).toBe(fontFamilies.hebrew);
    expect(fontFamilyForLanguage(Language.English)).toBe(fontFamilies.english);
    expect(fontFamilies.hebrew).toBe('Rubik');
    expect(fontFamilies.english).toBe('Inter');
  });

  it('exposes a combined theme object', () => {
    expect(theme.colors.accent).toBe('#00F5D4');
    expect(theme.spacing.md).toBe(16);
  });
});
