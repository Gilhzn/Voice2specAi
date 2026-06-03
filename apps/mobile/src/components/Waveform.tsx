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
 * fluid 60fps motion driven by the audio level. Bars fade toward the edges
 * for a soft, premium look.
 */
export function Waveform({ amplitude, active, barCount = 32 }: WaveformProps): React.JSX.Element {
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
  const height = useSharedValue(3);
  // Bell-shaped envelope: taller in the middle, shorter at the edges.
  const envelope = Math.sin((index / (barCount - 1)) * Math.PI);

  useEffect(() => {
    const jitter = 0.5 + 0.5 * Math.sin(index * 1.7 + amplitude * 6);
    const target = active ? 3 + amplitude * 46 * (0.35 + 0.65 * envelope) * jitter : 3;
    height.value = withSpring(target, { damping: 14, stiffness: 200, mass: 0.5 });
  }, [amplitude, active, index, envelope, height]);

  const animatedStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Animated.View
      style={[styles.bar, { opacity: active ? 0.45 + 0.55 * envelope : 0.25 }, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 64,
    gap: 3,
  },
  bar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
});
