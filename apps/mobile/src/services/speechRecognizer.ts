import Voice, {
  SpeechErrorEvent,
  SpeechResultsEvent,
} from '@react-native-voice/voice';

/**
 * On-device speech recognition (Android SpeechRecognizer / iOS SFSpeechRecognizer)
 * via @react-native-voice/voice. Free, no API key, no server — it transcribes
 * the user's real speech locally. The OS recognizer stops on each pause, so we
 * auto-restart to capture a whole conversation as a sequence of utterances.
 */

export interface SpeechCallbacks {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
}

export interface SpeechHandle {
  stop: () => Promise<void>;
}

/** Begin continuous recognition in `locale` (e.g. "he-IL", "en-US"). */
export async function startListening(
  locale: string,
  cb: SpeechCallbacks,
): Promise<SpeechHandle> {
  let active = true;
  let restarting = false;

  const restart = async () => {
    if (!active || restarting) return;
    restarting = true;
    try {
      await Voice.start(locale);
    } catch {
      /* will retry on next end event */
    } finally {
      restarting = false;
    }
  };

  Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
    const text = e.value?.[0];
    if (text) cb.onPartial(text);
  };
  Voice.onSpeechResults = (e: SpeechResultsEvent) => {
    const text = e.value?.[0];
    if (text && text.trim().length > 0) cb.onFinal(text.trim());
  };
  Voice.onSpeechError = (e: SpeechErrorEvent) => {
    // "No match"/"timeout" are normal between utterances — just restart.
    const code = e.error?.code ?? '';
    if (active && (code === '7' || code === '6' || code === 'recognition_fail' || code === '5')) {
      void restart();
      return;
    }
    if (e.error?.message) cb.onError?.(e.error.message);
  };
  Voice.onSpeechEnd = () => {
    // Recognizer finished an utterance; resume for the next one.
    void restart();
  };

  await Voice.start(locale);

  return {
    stop: async () => {
      active = false;
      try {
        await Voice.stop();
      } catch {
        /* ignore */
      }
      try {
        await Voice.destroy();
      } catch {
        /* ignore */
      }
      Voice.removeAllListeners();
    },
  };
}

/** Whether on-device speech recognition is available on this device. */
export async function isSpeechAvailable(): Promise<boolean> {
  try {
    const available = await Voice.isAvailable();
    return Boolean(available);
  } catch {
    return false;
  }
}
