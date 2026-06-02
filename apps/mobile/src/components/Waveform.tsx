import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors } from '../theme/designTokens';

interface WaveformProps {
  /** Live amplitude in [0,1]; drives the organic bar heights. */
  amplitude: number;
  /** Whether the waveform is active (recording). */
  active: boolean;
  barCount?: number;
}

/**
 * Organic, frequency-reactive waveform. Each bar springs toward a height
 * derived from the live amplitude plus a per-bar phase offset, producing a
 * fluid 60fps motion driven by the audio level.
 */
export function Waveform({ amplitude, active, barCount = 24 }: WaveformProps): React.JSX.Element {
  return (
    <View style={styles.container} testID="waveform">
      {Array.from({ length: barCount }).map((_, i) => (
        <Bar key={i} index={i} amplitude={amplitude} active={active} barCount={barCount} />
      ))}
    </View>
  );
}

function Bar({
  index,
  amplitude,
  active,
  barCount,
}: {
  index: number;
  amplitude: number;
  active: boolean;
  barCount: number;
}): React.JSX.Element {
  const height = useSharedValue(4);

  useEffect(() => {
    // Per-bar phase gives the waveform an organic, non-uniform shape.
    const phase = Math.sin((index / barCount) * Math.PI);
    const target = active ? 4 + amplitude * 56 * (0.4 + 0.6 * phase) : 4;
    height.value = withSpring(target, { damping: 12, stiffness: 180 });
  }, [amplitude, active, index, barCount, height]);

  const animatedStyle = useAnimatedStyle(() => ({ height: height.value }));

  return <Animated.View style={[styles.bar, animatedStyle]} />;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 72,
    gap: 4,
  },
  bar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
});
