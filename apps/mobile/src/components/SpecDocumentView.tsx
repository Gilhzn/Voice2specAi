import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { SpecDocument } from '@voice2spec/shared-types';
import { colors, spacing, typography } from '../theme/designTokens';

interface SpecDocumentViewProps {
  spec: SpecDocument;
}

/** Renders the generated Markdown specification with the dark premium theme. */
export function SpecDocumentView({ spec }: SpecDocumentViewProps): React.JSX.Element {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} testID="spec-document">
      <Markdown style={markdownStyles}>{spec.markdown}</Markdown>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
});

// react-native-markdown-display accepts a loosely-typed style map.
const markdownStyles = {
  body: { color: colors.textPrimary, ...typography.body },
  heading1: { color: colors.accent, ...typography.display, marginTop: spacing.lg },
  heading2: { color: colors.accent, ...typography.title, marginTop: spacing.md },
  heading3: { color: colors.textPrimary, ...typography.title },
  code_inline: { color: colors.accent, backgroundColor: colors.surfaceElevated },
  fence: { color: colors.textSecondary, backgroundColor: colors.surface, borderRadius: 8 },
  code_block: { color: colors.textSecondary, backgroundColor: colors.surface },
  bullet_list: { color: colors.textPrimary },
  blockquote: { color: colors.textSecondary, backgroundColor: colors.surface },
} as const;
