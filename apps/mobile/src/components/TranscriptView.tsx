import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TranscriptSegment } from '@voice2spec/shared-types';
import { colors, fontFamilyForLanguage, motion, spacing, typography } from '../theme/designTokens';
import { TranslationLine } from './TranslationLine';

interface TranscriptViewProps {
  segments: TranscriptSegment[];
}

/** Scrolling live transcript with a soft typewriter reveal on the newest line. */
export function TranscriptView({ segments }: TranscriptViewProps): React.JSX.Element {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} testID="transcript">
      {segments.map((seg, i) => (
        <SegmentRow key={seg.id} segment={seg} isLatest={i === segments.length - 1} />
      ))}
    </ScrollView>
  );
}

function SegmentRow({
  segment,
  isLatest,
}: {
  segment: TranscriptSegment;
  isLatest: boolean;
}): React.JSX.Element {
  const text = useTypewriter(segment.text, isLatest);
  return (
    <View style={[styles.row, segment.isFiltered && styles.filteredRow]}>
      <Text
        style={[
          styles.text,
          { fontFamily: fontFamilyForLanguage(segment.lang) },
          segment.isFiltered && styles.filteredText,
        ]}
      >
        {text}
      </Text>
      {!segment.isFiltered && <TranslationLine text={segment.translation} lang={segment.lang} />}
    </View>
  );
}

/** Reveals text one character at a time for the soft typewriter effect. */
export function useTypewriter(full: string, enabled: boolean): string {
  const [shown, setShown] = useState(enabled ? '' : full);

  useEffect(() => {
    if (!enabled) {
      setShown(full);
      return;
    }
    let i = 0;
    setShown('');
    const timer = setInterval(() => {
      i += 1;
      setShown(full.slice(0, i));
      if (i >= full.length) clearInterval(timer);
    }, motion.typewriterCharMs);
    return () => clearInterval(timer);
  }, [full, enabled]);

  return shown;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  row: { gap: spacing.xs },
  filteredRow: { opacity: 0.4 },
  text: { ...typography.body, color: colors.textPrimary },
  filteredText: { color: colors.textTertiary, textDecorationLine: 'line-through' },
});
