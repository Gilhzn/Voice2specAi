import { PermissionsAndroid, Platform } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';

/**
 * Real microphone capture, wrapping react-native-audio-recorder-player.
 * Records the session to a compressed audio file (AAC/MP4 on Android, m4a on
 * iOS) and reports a live metering level for the waveform. On stop it returns
 * the file URI, which the app uploads to the server for Whisper transcription.
 */
const player = new AudioRecorderPlayer();

/** Request the RECORD_AUDIO runtime permission on Android. */
export async function requestMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone access',
        message: 'Voice2Spec needs the microphone to record your conversation.',
        buttonPositive: 'Allow',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/** Map a dBFS metering value (~-60..0) to a 0..1 amplitude. */
function meterToAmplitude(db: number | undefined): number {
  if (db === undefined || Number.isNaN(db)) return 0;
  const clamped = Math.max(-60, Math.min(0, db));
  return (clamped + 60) / 60;
}

export interface RecorderHandle {
  /** Stop recording; resolves with the recorded file URI. */
  stop: () => Promise<string>;
}

/**
 * Start recording, invoking `onAmplitude` ~10×/sec with the live level.
 * Throws if the OS fails to start the recorder.
 */
export async function startRecording(onAmplitude: (a: number) => void): Promise<RecorderHandle> {
  player.setSubscriptionDuration(0.1);
  // Default Android output is AAC in an MP4 container (.mp4), which Whisper
  // accepts. `true` enables metering for the live waveform.
  const uri = await player.startRecorder(undefined, undefined, true);
  void uri;
  player.addRecordBackListener((e) => onAmplitude(meterToAmplitude(e.currentMetering)));

  return {
    stop: async () => {
      const result = await player.stopRecorder();
      player.removeRecordBackListener();
      return result;
    },
  };
}
