import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { RecordingState } from '@voice2spec/shared-types';
import { colors, elevation, spacing, typography } from '../theme/designTokens';

interface RecordButtonProps {
  state: RecordingState;
  onPress: () => void;
}

const SIZE = 88;

/**
 * The single one-tap toggle, as a premium circular control.
 *  - Idle      → teal-outlined ring with a soft breathing pulse ("Start")
 *  - Recording → filled teal core with an expanding halo ("Stop & Generate")
 *  - Generating→ dimmed with a rotating arc ("Generating…")
 */
export function RecordButton({ state, onPress }: RecordButtonProps): React.JSX.Element {
  const isRecording = state === RecordingState.Recording;
  const isGenerating = state === RecordingState.Generating;
  const label = isGenerating ? 'Generating…' : isRecording ? 'Stop & Generate' : 'Start';

  const halo = useSharedValue(0);
  const breathe = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(halo);
    cancelAnimation(breathe);
    cancelAnimation(spin);
    if (isRecording) {
      halo.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }), -1, false);
    } else if (isGenerating) {
      spin.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false);
    } else {
      breathe.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }), -1, true);
    }
  }, [isRecording, isGenerating, halo, breathe, spin]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - halo.value),
    transform: [{ scale: 1 + halo.value * 0.6 }],
  }));
  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.value * 0.05 }],
    opacity: 0.6 + breathe.value * 0.4,
  }));
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  return (
    <View style={styles.wrap}>
      {isRecording && <Animated.View style={[styles.halo, haloStyle]} pointerEvents="none" />}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isGenerating, busy: isGenerating }}
        testID="record-button"
        disabled={isGenerating}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          isRecording ? styles.recording : styles.idle,
          pressed && styles.pressed,
        ]}
      >
        {isGenerating ? (
          <Animated.View style={[styles.arc, spinStyle]} />
        ) : isRecording ? (
          <View style={styles.stopSquare} />
        ) : (
          <Animated.View style={[styles.innerDot, breatheStyle]} />
        )}
      </Pressable>

      <Text style={[styles.label, isRecording && styles.labelActive]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.md },
  halo: {
    position: 'absolute',
    top: 0,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.accentGlow,
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: {
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.accentFaint,
  },
  recording: {
    backgroundColor: colors.accent,
    ...elevation.glow,
  },
  pressed: { transform: [{ scale: 0.95 }] },
  innerDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
  },
  stopSquare: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: colors.background,
  },
  arc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.accentSoft,
    borderTopColor: colors.accent,
  },
  label: {
    ...typography.button,
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 13,
  },
  labelActive: { color: colors.accent },
});
