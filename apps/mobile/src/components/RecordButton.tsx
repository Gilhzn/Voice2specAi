import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RecordingState } from '@voice2spec/shared-types';
import { colors, radii, spacing, typography } from '../theme/designTokens';

interface RecordButtonProps {
  state: RecordingState;
  onPress: () => void;
}

/**
 * The single one-tap toggle. Two hard states:
 *  - Idle      → "Start"  (outlined teal ring)
 *  - Recording → "Stop & Generate" (filled teal, pulsing)
 * While Generating it is disabled and shows a progress label.
 */
export function RecordButton({ state, onPress }: RecordButtonProps): React.JSX.Element {
  const isRecording = state === RecordingState.Recording;
  const isGenerating = state === RecordingState.Generating;

  const label = isGenerating ? 'Generating…' : isRecording ? 'Stop & Generate' : 'Start';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isGenerating, busy: isGenerating }}
      testID="record-button"
      disabled={isGenerating}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isRecording ? styles.recording : styles.idle,
        isGenerating && styles.generating,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.dot, isRecording ? styles.dotRecording : styles.dotIdle]} />
      <Text style={[styles.label, isRecording && styles.labelRecording]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    minWidth: 220,
  },
  idle: {
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
  recording: {
    backgroundColor: colors.accent,
  },
  generating: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  dotIdle: { backgroundColor: colors.accent },
  dotRecording: { backgroundColor: colors.background },
  label: { ...typography.button, color: colors.accent },
  labelRecording: { color: colors.background },
});
