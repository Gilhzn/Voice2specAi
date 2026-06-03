import React, { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TranscriptSegment } from '@voice2spec/shared-types';
import { colors, radii, spacing, typography } from '../theme/designTokens';
import { SegmentCard } from './SegmentCard';

interface TranscriptViewProps {
  segments: TranscriptSegment[];
  /** Whether a recording session is active (affects the empty state copy). */
  recording: boolean;
}

/** Scrolling live transcript of segment cards, with a premium empty state. */
export function TranscriptView({ segments, recording }: TranscriptViewProps): React.JSX.Element {
  const scrollRef = useRef<ScrollView>(null);

  if (segments.length === 0) {
    return <EmptyState recording={recording} />;
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      testID="transcript"
      showsVerticalScrollIndicator={false}
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
    >
      {segments.map((seg, i) => (
        <SegmentCard key={seg.id} segment={seg} isLatest={i === segments.length - 1} />
      ))}
    </ScrollView>
  );
}

function EmptyState({ recording }: { recording: boolean }): React.JSX.Element {
  return (
    <View style={styles.empty} testID="transcript-empty">
      <View style={styles.emptyMark}>
        <View style={styles.emptyMarkInner} />
      </View>
      <Text style={styles.emptyTitle}>
        {recording ? 'Listening…' : 'Capture your brainstorm'}
      </Text>
      <Text style={styles.emptyBody}>
        {recording
          ? 'Speak naturally in Hebrew or English — the transcript and translation appear here in real time.'
          : 'Tap the button below to start. Voice2Spec transcribes your conversation, filters the noise, and turns it into a precise engineering spec.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.lg },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyMark: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyMarkInner: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
  },
  emptyTitle: { ...typography.title, color: colors.textPrimary, textAlign: 'center' },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
