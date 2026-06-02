import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Language } from '@voice2spec/shared-types';
import { colors, fontFamilyForLanguage, spacing, typography } from '../theme/designTokens';

interface TranslationLineProps {
  text: string;
  /** Source language; the translation is rendered in the opposite font. */
  lang: Language;
}

/** Dimmed, simultaneous translation rendered beneath a transcript segment. */
export function TranslationLine({ text, lang }: TranslationLineProps): React.JSX.Element {
  const targetLang = lang === Language.Hebrew ? Language.English : Language.Hebrew;
  return (
    <Text
      testID="translation-line"
      style={[styles.text, { fontFamily: fontFamilyForLanguage(targetLang) }]}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    ...typography.caption,
    color: colors.accentDim,
    marginLeft: spacing.sm,
  },
});
