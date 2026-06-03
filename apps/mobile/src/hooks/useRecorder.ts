import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ApiClient } from '../services/api';
import { generateDemoSpec, startDemoTranscript, DemoHandle } from '../services/demoEngine';
import { RecorderHandle, requestMicPermission, startRecording } from '../services/audioRecorder';

const USER_ID = 'demo-user';

type Mode = 'demo' | 'live';

/**
 * Unified recorder.
 *  - Live mode (a server URL is configured): records real microphone audio,
 *    uploads it on stop for Whisper transcription + Claude spec generation.
 *  - Demo mode (no server / unreachable): streams an on-device canned transcript
 *    and generates the spec locally.
 * The screen just calls start()/stop() and reads `amplitude`.
 */
export function useRecorder(onSpecReady: () => void) {
  const { startRecording: storeStart, stopRecording, upsertSegment, setSpec, setSpecProgress } =
    useAppStore();

  const [amplitude, setAmplitude] = useState(0);
  const [connection, setConnection] = useState<Mode | null>(null);

  const modeRef = useRef<Mode | null>(null);
  const demoRef = useRef<DemoHandle | null>(null);
  const recRef = useRef<RecorderHandle | null>(null);
  const apiRef = useRef<ApiClient | null>(null);

  const teardown = useCallback(() => {
    demoRef.current?.stop();
    demoRef.current = null;
    recRef.current?.stop().catch(() => undefined);
    recRef.current = null;
    setAmplitude(0);
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const startDemo = useCallback(() => {
    modeRef.current = 'demo';
    setConnection('demo');
    storeStart(`local-${Date.now()}`);
    demoRef.current = startDemoTranscript({ onSegment: upsertSegment, onAmplitude: setAmplitude });
  }, [storeStart, upsertSegment]);

  const startLive = useCallback(
    async (serverUrl: string) => {
      const api = new ApiClient(serverUrl);
      const { zeroRetention } = useAppStore.getState().settings;
      try {
        const { session } = await api.createSession({ userId: USER_ID, zeroRetention });
        const ok = await requestMicPermission();
        if (!ok) {
          // No mic permission — fall back to the on-device demo.
          startDemo();
          return;
        }
        apiRef.current = api;
        modeRef.current = 'live';
        setConnection('live');
        storeStart(session.id);
        recRef.current = await startRecording(setAmplitude);
      } catch {
        // Server unreachable or recorder failed — degrade to the demo.
        startDemo();
      }
    },
    [startDemo, storeStart],
  );

  const start = useCallback(() => {
    const serverUrl = useAppStore.getState().settings.serverUrl;
    if (serverUrl) void startLive(serverUrl);
    else startDemo();
  }, [startDemo, startLive]);

  const finishWithLocalSpec = useCallback(() => {
    const segs = useAppStore.getState().segments;
    const sessionId = useAppStore.getState().sessionId ?? `local-${Date.now()}`;
    setSpec(generateDemoSpec(sessionId, segs));
    onSpecReady();
  }, [onSpecReady, setSpec]);

  const stop = useCallback(async () => {
    const mode = modeRef.current;
    setSpecProgress(0.1);
    stopRecording();

    if (mode === 'live' && recRef.current && apiRef.current) {
      const api = apiRef.current;
      const sessionId = useAppStore.getState().sessionId ?? '';
      try {
        const uri = await recRef.current.stop();
        recRef.current = null;
        setAmplitude(0);
        setSpecProgress(0.4);
        const result = await api.transcribe(sessionId, USER_ID, uri);
        result.segments.forEach(upsertSegment);
        setSpec(result.spec);
        onSpecReady();
      } catch {
        // Transcription failed — still produce a local spec so the user isn't stuck.
        finishWithLocalSpec();
      }
      return;
    }

    // Demo mode: brief progress beat, then generate locally.
    teardown();
    setTimeout(finishWithLocalSpec, 600);
  }, [finishWithLocalSpec, onSpecReady, setSpec, setSpecProgress, stopRecording, teardown, upsertSegment]);

  return { amplitude, connection, start, stop };
}
