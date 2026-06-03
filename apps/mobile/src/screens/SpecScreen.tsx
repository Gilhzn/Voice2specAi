import React, { useCallback, useEffect, useLayoutEffect } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, radii, spacing, typography } from '../theme/designTokens';
import { SpecDocumentView } from '../components/SpecDocumentView';
import { useAppStore } from '../store/useAppStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Spec'>;

/** Displays the generated specification, or an animated progress state. */
export function SpecScreen({ navigation }: Props): React.JSX.Element {
  const { spec, specProgress } = useAppStore();

  const onShare = useCallback(() => {
    if (!spec) return;
    void Share.share({ title: 'Voice2Spec — Specification', message: spec.markdown });
  }, [spec]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        spec ? (
          <Pressable onPress={onShare} hitSlop={8} testID="share-spec">
            <Text style={styles.share}>Share</Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, spec, onShare]);

  if (!spec) {
    return <Generating progress={specProgress} />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
      >
        {spec.sections.map((title, i) => (
          <View key={title} style={styles.chip}>
            <Text style={styles.chipIndex}>{i + 1}</Text>
            <Text style={styles.chipText} numberOfLines={1}>
              {title}
            </Text>
          </View>
        ))}
      </ScrollView>
      <SpecDocumentView spec={spec} />
    </View>
  );
}

function Generating({ progress }: { progress: number }): React.JSX.Element {
  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [shimmer]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.max(8, progress * 100)}%`,
    opacity: 0.7 + shimmer.value * 0.3,
  }));

  return (
    <SafeAreaView style={styles.center} testID="spec-pending" edges={['bottom']}>
      <View style={styles.pulseRing}>
        <View style={styles.pulseCore} />
      </View>
      <Text style={styles.genTitle}>Generating specification</Text>
      <Text style={styles.genBody}>
        Filtering the conversation and synthesizing a deep, production-ready PRD.
      </Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, barStyle]} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  share: { ...typography.button, fontSize: 15, color: colors.accent },
  chipsScroll: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chips: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 220,
  },
  chipIndex: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
  },
  chipText: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.md,
  },
  pulseRing: {
    width: 84,
    height: 84,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  pulseCore: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent },
  genTitle: { ...typography.title, color: colors.textPrimary, textAlign: 'center' },
  genBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
  },
  track: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
});
