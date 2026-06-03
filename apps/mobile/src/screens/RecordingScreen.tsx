import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/designTokens';
import { RecordButton } from '../components/RecordButton';
import { Waveform } from '../components/Waveform';
import { TranscriptView } from '../components/TranscriptView';
import { useAppStore } from '../store/useAppStore';
import { DemoHandle, generateDemoSpec, startDemoTranscript } from '../services/demoEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'Recording'>;

/**
 * Primary screen: the one-tap recorder. The downloadable APK runs without a
 * backend, so it drives an on-device demo engine — Start streams a live
 * bilingual transcript, Stop generates the specification locally and navigates
 * to the Spec screen. (The server-backed WebSocket path lives in the hooks/api
 * services for when a backend is configured.)
 */
export function RecordingScreen({ navigation }: Props): React.JSX.Element {
  const {
    recordingState,
    segments,
    startRecording,
    stopRecording,
    upsertSegment,
    setSpec,
    setSpecProgress,
  } = useAppStore();

  const [amplitude, setAmplitude] = useState(0);
  const demoRef = useRef<DemoHandle | null>(null);

  // Clean up timers if the screen unmounts mid-recording.
  useEffect(() => () => demoRef.current?.stop(), []);

  const handlePress = useCallback(() => {
    if (recordingState === 'idle') {
      const sessionId = `local-${Date.now()}`;
      startRecording(sessionId);
      demoRef.current = startDemoTranscript({
        onSegment: upsertSegment,
        onAmplitude: setAmplitude,
      });
    } else if (recordingState === 'recording') {
      demoRef.current?.stop();
      demoRef.current = null;
      setAmplitude(0);
      stopRecording();

      // Generate the spec from the captured segments, with a brief progress beat.
      setSpecProgress(0.1);
      const current = useAppStore.getState().segments;
      const sessionId = useAppStore.getState().sessionId ?? `local-${Date.now()}`;
      setTimeout(() => {
        const spec = generateDemoSpec(sessionId, current);
        setSpec(spec);
        navigation.navigate('Spec');
      }, 600);
    }
  }, [recordingState, startRecording, stopRecording, upsertSegment, setSpec, setSpecProgress, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          {recordingState === 'recording'
            ? 'Listening — speak Hebrew or English'
            : 'Tap to capture your brainstorm'}
        </Text>
        <Pressable onPress={() => navigation.navigate('Settings')} testID="open-settings">
          <Text style={styles.settingsLink}>Settings</Text>
        </Pressable>
      </View>

      <TranscriptView segments={segments} />

      <View style={styles.footer}>
        <Waveform amplitude={amplitude} active={recordingState === 'recording'} />
        <RecordButton state={recordingState} onPress={handlePress} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  subtitle: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  settingsLink: { ...typography.caption, color: colors.accent },
  footer: { padding: spacing.lg, gap: spacing.lg, alignItems: 'center' },
});
