import { PermissionsAndroid, Platform } from 'react-native';
import LiveAudioStream from '@fugood/react-native-audio-pcm-stream';

/**
 * Streaming microphone capture. Emits base64-encoded raw PCM (linear16, 16kHz
 * mono) frames in real time, which the app forwards over the WebSocket to the
 * server for live (Deepgram) transcription.
 */

const OPTIONS = {
  sampleRate: 16000,
  channels: 1,
  bitsPerSample: 16,
  audioSource: 6, // Android VOICE_RECOGNITION
  bufferSize: 4096,
  wavFile: '',
};

/** Request the RECORD_AUDIO runtime permission on Android. */
export async function requestMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
      title: 'Microphone access',
      message: 'Voice2Spec needs the microphone to record your conversation.',
      buttonPositive: 'Allow',
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export interface PcmHandle {
  stop: () => void;
}

/**
 * Start streaming PCM. `onFrame` receives base64 PCM for each buffer; the
 * resolved handle stops capture and detaches the listener.
 */
export function startPcmStream(onFrame: (base64: string) => void): PcmHandle {
  LiveAudioStream.init(OPTIONS);
  LiveAudioStream.on('data', onFrame);
  LiveAudioStream.start();
  return {
    stop: () => {
      try {
        LiveAudioStream.stop();
      } catch {
        /* ignore */
      }
    },
  };
}
