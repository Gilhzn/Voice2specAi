import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../theme/designTokens';
import { useAppStore } from '../store/useAppStore';

/**
 * Settings screen. Hosts the Zero-Retention toggle: when enabled, raw audio
 * and transcripts are purged from the server the moment the spec is produced.
 */
export function SettingsScreen(): React.JSX.Element {
  const { settings, toggleZeroRetention } = useAppStore();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.row}>
        <View style={styles.labelGroup}>
          <Text style={styles.label}>Zero-Retention Mode</Text>
          <Text style={styles.hint}>
            Permanently delete raw audio and transcripts from the server as soon as the
            specification is generated.
          </Text>
        </View>
        <Switch
          testID="zero-retention-switch"
          value={settings.zeroRetention}
          onValueChange={toggleZeroRetention}
          trackColor={{ true: colors.accent, false: colors.border }}
          thumbColor={colors.textPrimary}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  labelGroup: { flex: 1, gap: spacing.xs },
  label: { ...typography.body, color: colors.textPrimary },
  hint: { ...typography.caption, color: colors.textSecondary },
});
