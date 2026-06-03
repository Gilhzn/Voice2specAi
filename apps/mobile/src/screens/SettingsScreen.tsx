import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../theme/designTokens';
import { useAppStore } from '../store/useAppStore';
import { ApiClient } from '../services/api';

type TestState =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok'; detail: string }
  | { kind: 'error'; detail: string };

/**
 * Settings: server connection (URL + live health test), privacy (Zero-Retention),
 * and an About section. When a server URL is set and reachable, recordings stream
 * through the real backend; otherwise the app runs the on-device demo.
 */
export function SettingsScreen(): React.JSX.Element {
  const { settings, toggleZeroRetention, setServerUrl, setSttLanguage } = useAppStore();
  const [url, setUrl] = useState(settings.serverUrl);
  const [test, setTest] = useState<TestState>({ kind: 'idle' });

  const LANGS: { code: string; label: string }[] = [
    { code: 'he-IL', label: 'עברית' },
    { code: 'en-US', label: 'English' },
  ];

  const save = (value: string) => {
    setUrl(value);
    setServerUrl(value);
    setTest({ kind: 'idle' });
  };

  const runTest = async () => {
    if (!url.trim()) {
      setTest({ kind: 'error', detail: 'Enter a server URL first' });
      return;
    }
    setTest({ kind: 'testing' });
    try {
      const health = await new ApiClient(url).health();
      setTest({
        kind: 'ok',
        detail: `Online · STT ${health.services.whisper} · Claude ${health.services.claude} · DB ${health.services.database}`,
      });
    } catch (e) {
      setTest({ kind: 'error', detail: 'Could not reach the server' });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Connection */}
        <Text style={styles.sectionLabel}>CONNECTION</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Server URL</Text>
          <Text style={styles.hint}>
            Run the Voice2Spec server and enter its address (e.g. http://192.168.1.50:4000). Leave
            blank to use the on-device demo.
          </Text>
          <TextInput
            value={url}
            onChangeText={save}
            placeholder="http://host:4000"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
            testID="server-url-input"
          />
          <View style={styles.testRow}>
            <Pressable
              onPress={runTest}
              style={({ pressed }) => [styles.testBtn, pressed && styles.pressed]}
              testID="test-connection"
            >
              {test.kind === 'testing' ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Text style={styles.testBtnText}>Test connection</Text>
              )}
            </Pressable>
            <View style={styles.statusDotWrap}>
              <View
                style={[
                  styles.statusDot,
                  test.kind === 'ok' && { backgroundColor: colors.success },
                  test.kind === 'error' && { backgroundColor: colors.error },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  test.kind === 'ok' && { color: colors.success },
                  test.kind === 'error' && { color: colors.error },
                ]}
                numberOfLines={2}
              >
                {test.kind === 'idle'
                  ? settings.serverUrl
                    ? 'Server configured'
                    : 'Demo mode'
                  : test.kind === 'testing'
                    ? 'Testing…'
                    : test.detail}
              </Text>
            </View>
          </View>
        </View>

        {/* Speech */}
        <Text style={styles.sectionLabel}>SPEECH RECOGNITION</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Spoken language</Text>
          <Text style={styles.hint}>
            On-device transcription runs in this language. Pick the language you’ll mostly speak.
          </Text>
          <View style={styles.segment}>
            {LANGS.map((l) => {
              const active = settings.sttLanguage === l.code;
              return (
                <Pressable
                  key={l.code}
                  onPress={() => setSttLanguage(l.code)}
                  style={[styles.segmentItem, active && styles.segmentItemActive]}
                  testID={`lang-${l.code}`}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {l.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Privacy */}
        <Text style={styles.sectionLabel}>PRIVACY</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLabel}>
              <Text style={styles.label}>Zero-Retention Mode</Text>
              <Text style={styles.hint}>
                Permanently delete raw audio and transcripts from the server the moment the
                specification is generated.
              </Text>
            </View>
            <Switch
              testID="zero-retention-switch"
              value={settings.zeroRetention}
              onValueChange={toggleZeroRetention}
              trackColor={{ true: colors.accent, false: colors.borderStrong }}
              thumbColor={colors.textPrimary}
            />
          </View>
        </View>

        {/* About */}
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.card}>
          <Row k="App" v="Voice2Spec AI" />
          <View style={styles.divider} />
          <Row k="Version" v="1.0.0" />
          <View style={styles.divider} />
          <Row k="Security" v="AES-256-GCM · PII masking · TLS 1.3" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ k, v }: { k: string; v: string }): React.JSX.Element {
  return (
    <View style={styles.aboutRow}>
      <Text style={styles.aboutKey}>{k}</Text>
      <Text style={styles.aboutVal}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
  sectionLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    letterSpacing: 1.5,
    marginTop: spacing.md,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  hint: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  input: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...typography.body,
    marginTop: spacing.xs,
  },
  testRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  testBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    minWidth: 130,
    alignItems: 'center',
  },
  testBtnText: { ...typography.button, fontSize: 14, color: colors.background },
  pressed: { opacity: 0.8 },
  statusDotWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textTertiary },
  statusText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { flex: 1, gap: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 3,
    marginTop: spacing.xs,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  segmentItemActive: { backgroundColor: colors.accent },
  segmentText: { ...typography.body, color: colors.textSecondary },
  segmentTextActive: { color: colors.background, fontWeight: '700' },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  aboutKey: { ...typography.body, color: colors.textSecondary },
  aboutVal: { ...typography.body, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
});
