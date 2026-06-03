import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ApiClient } from '../services/api';
import { generateLocalSpec, makeSegment } from '../services/localTranscript';
import { startDemoTranscript, DemoHandle } from '../services/demoEngine';
import { requestMicPermission } from '../services/permissions';
import { isSpeechAvailable, SpeechHandle, startListening } from '../services/speechRecognizer';

const USER_ID = 'demo-user';

type Mode = 'device' | 'canned';

/**
 * Recorder built around on-device speech recognition (no server, no API key):
 * it transcribes the user's real speech live, then builds the specification
 * from those actual words. If a server URL is configured, the final spec is
 * upgraded by Claude on the server; otherwise it is generated on-device.
 * Falls back to a canned demo only if speech recognition is unavailable.
 */
export function useRecorder(onSpecReady: () => void) {
  const { startRecording: storeStart, stopRecording, upsertSegment, setSpec, setSpecProgress } =
    useAppStore();

  const [amplitude, setAmplitude] = useState(0);
  const [connection, setConnection] = useState<'device' | 'live' | null>(null);

  const modeRef = useRef<Mode | null>(null);
  const speechRef = useRef<SpeechHandle | null>(null);
  const demoRef = useRef<DemoHandle | null>(null);
  const interimIdRef = useRef<string | null>(null);
  const ampTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const teardown = useCallback(() => {
    speechRef.current?.stop().catch(() => undefined);
    speechRef.current = null;
    demoRef.current?.stop();
    demoRef.current = null;
    if (ampTimer.current) clearInterval(ampTimer.current);
    ampTimer.current = null;
    setAmplitude(0);
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const startCanned = useCallback(() => {
    modeRef.current = 'canned';
    setConnection('device');
    storeStart(`local-${Date.now()}`);
    demoRef.current = startDemoTranscript({ onSegment: upsertSegment, onAmplitude: setAmplitude });
  }, [storeStart, upsertSegment]);

  const start = useCallback(async () => {
    const granted = await requestMicPermission();
    const available = granted && (await isSpeechAvailable());
    if (!available) {
      // No mic / recognizer — fall back to a canned walkthrough.
      startCanned();
      return;
    }

    modeRef.current = 'device';
    setConnection(useAppStore.getState().settings.serverUrl ? 'live' : 'device');
    storeStart(`local-${Date.now()}`);
    interimIdRef.current = null;

    // Lightweight reactive waveform while listening.
    ampTimer.current = setInterval(() => setAmplitude(0.3 + Math.random() * 0.6), 120);

    const locale = useAppStore.getState().settings.sttLanguage || 'he-IL';
    try {
      speechRef.current = await startListening(locale, {
        onPartial: (text) => {
          if (!interimIdRef.current) interimIdRef.current = `seg-${Date.now()}`;
          upsertSegment(makeSegment(text, false, interimIdRef.current));
        },
        onFinal: (text) => {
          const id = interimIdRef.current ?? `seg-${Date.now()}`;
          interimIdRef.current = null;
          upsertSegment(makeSegment(text, true, id));
        },
      });
    } catch {
      teardown();
      startCanned();
    }
  }, [startCanned, storeStart, teardown, upsertSegment]);

  const finishLocal = useCallback(() => {
    const segs = useAppStore.getState().segments;
    const sessionId = useAppStore.getState().sessionId ?? `local-${Date.now()}`;
    setSpec(generateLocalSpec(sessionId, segs));
    onSpecReady();
  }, [onSpecReady, setSpec]);

  const stop = useCallback(async () => {
    setSpecProgress(0.15);
    stopRecording();
    await speechRef.current?.stop().catch(() => undefined);
    speechRef.current = null;
    demoRef.current?.stop();
    demoRef.current = null;
    if (ampTimer.current) clearInterval(ampTimer.current);
    ampTimer.current = null;
    setAmplitude(0);

    const serverUrl = useAppStore.getState().settings.serverUrl;
    const segs = useAppStore.getState().segments.filter((s) => !s.isFiltered && s.text.trim());

    // With a server, upgrade the spec with Claude using the captured transcript.
    if (serverUrl && segs.length > 0) {
      setSpecProgress(0.5);
      try {
        const res = await new ApiClient(serverUrl).specFromText(
          USER_ID,
          segs.map((s) => s.text),
        );
        setSpec(res.spec);
        onSpecReady();
        return;
      } catch {
        /* fall back to the on-device spec */
      }
    }

    setTimeout(finishLocal, 400);
  }, [finishLocal, onSpecReady, setSpec, setSpecProgress, stopRecording]);

  return { amplitude, connection, start, stop };
}
