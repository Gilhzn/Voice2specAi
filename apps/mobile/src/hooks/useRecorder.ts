import { useCallback, useEffect, useRef, useState } from 'react';
import { ServerMessage, WsMessageType } from '@voice2spec/shared-types';
import { useAppStore } from '../store/useAppStore';
import { ApiClient } from '../services/api';
import { DemoHandle, generateDemoSpec, startDemoTranscript } from '../services/demoEngine';

const USER_ID = 'demo-user';
// A tiny base64 placeholder chunk; real microphone capture is a native module.
const FAKE_CHUNK = 'ZmFrZS1hdWRpbw==';

type Mode = 'demo' | 'live';

/**
 * Unified recorder. When a server URL is configured it drives the real
 * REST + WebSocket pipeline; otherwise (or if the server is unreachable) it
 * falls back to the on-device demo engine. Either way the screen just calls
 * start()/stop() and reads `amplitude`.
 */
export function useRecorder(onSpecReady: () => void) {
  const {
    startRecording,
    stopRecording,
    upsertSegment,
    setTranslation,
    setSpec,
    setSpecProgress,
  } = useAppStore();

  const [amplitude, setAmplitude] = useState(0);
  const [connection, setConnection] = useState<'demo' | 'live' | null>(null);

  const modeRef = useRef<Mode | null>(null);
  const demoRef = useRef<DemoHandle | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const ampTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (audioTimer.current) clearInterval(audioTimer.current);
    if (ampTimer.current) clearInterval(ampTimer.current);
    audioTimer.current = null;
    ampTimer.current = null;
  }, []);

  const teardown = useCallback(() => {
    demoRef.current?.stop();
    demoRef.current = null;
    clearTimers();
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
    setAmplitude(0);
  }, [clearTimers]);

  useEffect(() => () => teardown(), [teardown]);

  const startDemo = useCallback(() => {
    modeRef.current = 'demo';
    setConnection('demo');
    const sessionId = `local-${Date.now()}`;
    startRecording(sessionId);
    demoRef.current = startDemoTranscript({ onSegment: upsertSegment, onAmplitude: setAmplitude });
  }, [startRecording, upsertSegment]);

  const startLive = useCallback(
    async (serverUrl: string) => {
      const api = new ApiClient(serverUrl);
      const { zeroRetention } = useAppStore.getState().settings;
      try {
        const { session } = await api.createSession({ userId: USER_ID, zeroRetention });
        modeRef.current = 'live';
        setConnection('live');
        startRecording(session.id);

        const ws = new WebSocket(api.wsUrl(session.id, USER_ID));
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: WsMessageType.StartSession,
              sessionId: session.id,
              sampleRate: 16000,
            }),
          );
          let seq = 0;
          audioTimer.current = setInterval(() => {
            ws.send(
              JSON.stringify({
                type: WsMessageType.AudioChunk,
                sessionId: session.id,
                seq: seq++,
                data: FAKE_CHUNK,
              }),
            );
          }, 750);
          ampTimer.current = setInterval(() => setAmplitude(0.25 + Math.random() * 0.75), 80);
        };

        ws.onmessage = (event) => {
          let msg: ServerMessage;
          try {
            msg = JSON.parse(String(event.data)) as ServerMessage;
          } catch {
            return;
          }
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
              teardown();
              onSpecReady();
              break;
            default:
              break;
          }
        };

        ws.onerror = () => {
          /* surfaced via the closed connection; spec generation will time out */
        };
      } catch {
        // Server unreachable — degrade gracefully to the on-device demo.
        startDemo();
      }
    },
    [onSpecReady, setSpec, setSpecProgress, setTranslation, startDemo, startRecording, upsertSegment],
  );

  const start = useCallback(() => {
    const serverUrl = useAppStore.getState().settings.serverUrl;
    if (serverUrl) void startLive(serverUrl);
    else startDemo();
  }, [startDemo, startLive]);

  const stop = useCallback(() => {
    const mode = modeRef.current;
    setSpecProgress(0.1);
    stopRecording();

    if (mode === 'live' && wsRef.current) {
      clearTimers();
      setAmplitude(0);
      const sessionId = useAppStore.getState().sessionId;
      wsRef.current.send(
        JSON.stringify({ type: WsMessageType.StopSession, sessionId, generateSpec: true }),
      );
      // SpecComplete arrives via onmessage; a safety net regenerates locally.
      setTimeout(() => {
        if (useAppStore.getState().spec === null) {
          const segs = useAppStore.getState().segments;
          setSpec(generateDemoSpec(sessionId ?? `local-${Date.now()}`, segs));
          teardown();
          onSpecReady();
        }
      }, 8000);
      return;
    }

    // Demo mode: generate locally with a brief progress beat.
    teardown();
    const segs = useAppStore.getState().segments;
    const sessionId = useAppStore.getState().sessionId ?? `local-${Date.now()}`;
    setTimeout(() => {
      setSpec(generateDemoSpec(sessionId, segs));
      onSpecReady();
    }, 600);
  }, [clearTimers, onSpecReady, setSpec, setSpecProgress, stopRecording, teardown]);

  return { amplitude, connection, start, stop };
}
