import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ServerMessage, WsMessageType } from '@voice2spec/shared-types';
import { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/designTokens';
import { RecordButton } from '../components/RecordButton';
import { Waveform } from '../components/Waveform';
import { TranscriptView } from '../components/TranscriptView';
import { useAppStore } from '../store/useAppStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAudioStream } from '../hooks/useAudioStream';
import { api } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Recording'>;

const USER_ID = 'demo-user';

/**
 * Primary screen: the one-tap recorder. Owns the WebSocket + audio stream and
 * renders the live waveform and bilingual transcript. On stop it triggers spec
 * generation and navigates to the Spec screen when the document arrives.
 */
export function RecordingScreen({ navigation }: Props): React.JSX.Element {
  const {
    recordingState,
    sessionId,
    segments,
    settings,
    startRecording,
    stopRecording,
    upsertSegment,
    setTranslation,
    setSpec,
    setSpecProgress,
  } = useAppStore();

  const onMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case WsMessageType.TranscriptPartial:
        case WsMessageType.TranscriptFinal:
          upsertSegment(msg.segment);
          break;
        case WsMessageType.Translation:
          setTranslation(msg.segmentId, msg.translation);
          break;
        case WsMessageType.SpecProgress:
          setSpecProgress(msg.progress);
          break;
        case WsMessageType.SpecComplete:
          setSpec(msg.spec);
          navigation.navigate('Spec');
          break;
        default:
          break;
      }
    },
    [upsertSegment, setTranslation, setSpecProgress, setSpec, navigation],
  );

  const wsUrl = sessionId ? api.wsUrl(sessionId, USER_ID) : null;
  const { send } = useWebSocket({ url: wsUrl, onMessage });

  const { amplitude, start: startCapture, stop: stopCapture } = useAudioStream({
    sessionId,
    sendChunk: (seq, data) =>
      sessionId && send({ type: WsMessageType.AudioChunk, sessionId, seq, data }),
  });

  const handlePress = useCallback(async () => {
    if (recordingState === 'idle') {
      const { session } = await api.createSession({
        userId: USER_ID,
        zeroRetention: settings.zeroRetention,
      });
      startRecording(session.id);
      send({ type: WsMessageType.StartSession, sessionId: session.id, sampleRate: 16000 });
      await startCapture();
    } else if (recordingState === 'recording') {
      await stopCapture();
      stopRecording();
      if (sessionId) {
        send({ type: WsMessageType.StopSession, sessionId, generateSpec: true });
      }
    }
  }, [
    recordingState,
    settings.zeroRetention,
    sessionId,
    startRecording,
    stopRecording,
    send,
    startCapture,
    stopCapture,
  ]);

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
