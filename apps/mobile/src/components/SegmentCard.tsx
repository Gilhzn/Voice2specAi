import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Language, TranscriptSegment } from '@voice2spec/shared-types';
import { colors, fontFamilyForLanguage, radii, spacing, typography } from '../theme/designTokens';

interface SegmentCardProps {
  segment: TranscriptSegment;
  /** Animate the text in with a soft typewriter reveal (newest segment). */
  isLatest: boolean;
}

/** A single transcript utterance rendered as a card with a language badge. */
export function SegmentCard({ segment, isLatest }: SegmentCardProps): React.JSX.Element {
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [enter]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 12 }],
  }));

  const isHe = segment.lang === Language.Hebrew;
  const text = useTypewriter(segment.text, isLatest && !segment.isFiltered);

  if (segment.isFiltered) {
    return (
      <Animated.View style={[styles.filteredRow, animatedStyle]}>
        <View style={styles.filteredTag}>
          <Text style={styles.filteredTagText}>filtered</Text>
        </View>
        <Text style={styles.filteredText} numberOfLines={1}>
          {segment.text}
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.card, animatedStyle]}>
      <View style={styles.header}>
        <View style={[styles.badge, isHe ? styles.badgeHe : styles.badgeEn]}>
          <Text style={[styles.badgeText, isHe ? styles.badgeHeText : styles.badgeEnText]}>
            {isHe ? 'עברית' : 'English'}
          </Text>
        </View>
      </View>
      <Text style={[styles.text, { fontFamily: fontFamilyForLanguage(segment.lang) }]}>{text}</Text>
      {segment.translation ? (
        <View style={styles.translationRow}>
          <View style={styles.translationBar} />
          <Text style={styles.translation}>{segment.translation}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

/** Reveals text one character at a time for the soft typewriter effect. */
export function useTypewriter(full: string, enabled: boolean): string {
  const [shown, setShown] = React.useState(enabled ? '' : full);
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
    }, 16);
    return () => clearInterval(timer);
  }, [full, enabled]);
  return shown;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  badgeHe: { backgroundColor: colors.badgeHe },
  badgeEn: { backgroundColor: colors.badgeEn },
  badgeText: { ...typography.caption, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  badgeHeText: { color: colors.badgeHeText },
  badgeEnText: { color: colors.badgeEnText },
  text: { ...typography.body, color: colors.textPrimary },
  translationRow: { flexDirection: 'row', gap: spacing.sm },
  translationBar: {
    width: 2,
    borderRadius: 1,
    backgroundColor: colors.accentDim,
  },
  translation: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 19 },
  filteredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    opacity: 0.5,
  },
  filteredTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.filtered,
  },
  filteredTagText: { ...typography.caption, fontSize: 10, color: colors.textTertiary },
  filteredText: {
    ...typography.caption,
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
    flex: 1,
  },
});
