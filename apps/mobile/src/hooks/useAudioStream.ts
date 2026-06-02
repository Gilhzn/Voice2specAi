import { useCallback, useEffect, useRef, useState } from 'react';
import { audioCapture, AudioCapture } from '../services/audioCapture';

interface UseAudioStreamOptions {
  sessionId: string | null;
  /** Send a single audio-chunk message over the transport. */
  sendChunk: (seq: number, data: string) => void;
  capture?: AudioCapture;
}

/**
 * Drives the audio capture lifecycle and forwards each chunk to the transport
 * as a WsMessageType.AudioChunk. Tracks the live amplitude for the waveform
 * via a lightweight polling loop while recording.
 */
export function useAudioStream({ sessionId, sendChunk, capture = audioCapture }: UseAudioStreamOptions) {
  const [amplitude, setAmplitude] = useState(0);
  const rafRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async () => {
    if (!sessionId) return;
    await capture.start(({ seq, data }) => sendChunk(seq, data));
    rafRef.current = setInterval(() => setAmplitude(capture.amplitude()), 1000 / 30);
  }, [sessionId, sendChunk, capture]);

  const stop = useCallback(async () => {
    await capture.stop();
    if (rafRef.current) clearInterval(rafRef.current);
    rafRef.current = null;
    setAmplitude(0);
  }, [capture]);

  useEffect(() => {
    return () => {
      if (rafRef.current) clearInterval(rafRef.current);
      void capture.stop();
    };
  }, [capture]);

  return { amplitude, start, stop, isActive: capture.isActive() };
}
