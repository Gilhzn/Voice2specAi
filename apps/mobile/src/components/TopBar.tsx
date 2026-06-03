import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, radii, spacing, typography } from '../theme/designTokens';

interface TopBarProps {
  recording: boolean;
  /** Elapsed recording time in seconds. */
  elapsed: number;
  /** Active connection mode, shown as a small tag. */
  connection: 'demo' | 'live' | null;
  onSettings: () => void;
}

function mmss(total: number): string {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** App header: brand mark + title, a live REC pill while recording, settings. */
export function TopBar({ recording, elapsed, connection, onSettings }: TopBarProps): React.JSX.Element {
  const blink = useSharedValue(1);
  useEffect(() => {
    if (recording) {
      blink.value = withRepeat(withTiming(0.2, { duration: 700 }), -1, true);
    } else {
      blink.value = 1;
    }
  }, [recording, blink]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        <View style={styles.mark}>
          <View style={styles.markDot} />
        </View>
        <View>
          <Text style={styles.title}>Voice2Spec</Text>
          <Text style={styles.subtitle}>
            {connection === 'live' ? 'Connected to server' : 'AI spec generator'}
          </Text>
        </View>
      </View>

      <View style={styles.right}>
        {recording ? (
          <View style={styles.recPill}>
            <Animated.View style={[styles.recDot, dotStyle]} />
            <Text style={styles.recText}>{mmss(elapsed)}</Text>
          </View>
        ) : (
          <Pressable
            onPress={onSettings}
            testID="open-settings"
            style={({ pressed }) => [styles.settingsBtn, pressed && styles.pressed]}
            hitSlop={8}
          >
            <View style={styles.gearOuter}>
              <View style={styles.gearInner} />
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mark: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
  title: { ...typography.title, fontSize: 19, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textTertiary },
  right: { minWidth: 44, alignItems: 'flex-end' },
  recPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentDim,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  recText: { ...typography.caption, color: colors.accent, fontWeight: '700', letterSpacing: 1 },
  settingsBtn: { padding: spacing.xs },
  pressed: { opacity: 0.6 },
  gearOuter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.textSecondary },
});
