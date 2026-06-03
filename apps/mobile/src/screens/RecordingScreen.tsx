import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RecordingState } from '@voice2spec/shared-types';
import { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/designTokens';
import { RecordButton } from '../components/RecordButton';
import { Waveform } from '../components/Waveform';
import { TranscriptView } from '../components/TranscriptView';
import { TopBar } from '../components/TopBar';
import { useAppStore } from '../store/useAppStore';
import { useRecorder } from '../hooks/useRecorder';

type Props = NativeStackScreenProps<RootStackParamList, 'Recording'>;

/**
 * Primary screen: the one-tap recorder. Uses {@link useRecorder}, which streams
 * from a configured server (REST + WebSocket) or, when none is set / reachable,
 * from the on-device demo engine. Renders the live waveform and transcript.
 */
export function RecordingScreen({ navigation }: Props): React.JSX.Element {
  const { recordingState, segments } = useAppStore();
  const isRecording = recordingState === RecordingState.Recording;

  const onSpecReady = useCallback(() => navigation.navigate('Spec'), [navigation]);
  const { amplitude, connection, start, stop } = useRecorder(onSpecReady);

  const [elapsed, setElapsed] = useState(0);
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRecording) {
      setElapsed(0);
      elapsedTimer.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else if (elapsedTimer.current) {
      clearInterval(elapsedTimer.current);
      elapsedTimer.current = null;
    }
    return () => {
      if (elapsedTimer.current) clearInterval(elapsedTimer.current);
    };
  }, [isRecording]);

  const handlePress = useCallback(() => {
    if (recordingState === RecordingState.Idle) start();
    else if (recordingState === RecordingState.Recording) stop();
  }, [recordingState, start, stop]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <TopBar
        recording={isRecording}
        elapsed={elapsed}
        connection={connection}
        onSettings={() => navigation.navigate('Settings')}
      />

      <TranscriptView segments={segments} recording={isRecording} />

      <View style={styles.footer}>
        <Waveform amplitude={amplitude} active={isRecording} />
        <RecordButton state={recordingState} onPress={handlePress} />
        <Text style={styles.hint}>
          {recordingState === RecordingState.Generating
            ? 'Synthesizing your specification…'
            : isRecording
              ? 'Tap to stop and generate the spec'
              : connection === null
                ? 'On-device demo · configure a server in Settings'
                : 'Ready'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hint: { ...typography.caption, color: colors.textTertiary, textAlign: 'center' },
});
