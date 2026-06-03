import { useCallback, useEffect, useRef, useState } from 'react';
import { ServerMessage, WsMessageType } from '@voice2spec/shared-types';
import { useAppStore } from '../store/useAppStore';
import { ApiClient } from '../services/api';
import { generateDemoSpec, startDemoTranscript, DemoHandle } from '../services/demoEngine';
import { PcmHandle, requestMicPermission, startPcmStream } from '../services/pcmRecorder';

const USER_ID = 'demo-user';

type Mode = 'demo' | 'live';

/**
 * Unified recorder.
 *  - Live mode (a server URL is configured): streams real microphone PCM over a
 *    WebSocket to the server, which proxies to Deepgram for live word-by-word
 *    transcription, then Claude generates the spec on stop.
 *  - Demo mode (no server / unreachable / permission denied): streams an
 *    on-device canned transcript and generates the spec locally.
 */
export function useRecorder(onSpecReady: () => void) {
  const { startRecording: storeStart, stopRecording, upsertSegment, setTranslation, setSpec, setSpecProgress } =
    useAppStore();

  const [amplitude, setAmplitude] = useState(0);
  const [connection, setConnection] = useState<Mode | null>(null);

  const modeRef = useRef<Mode | null>(null);
  const demoRef = useRef<DemoHandle | null>(null);
  const pcmRef = useRef<PcmHandle | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const seqRef = useRef(0);

  const teardown = useCallback(() => {
    demoRef.current?.stop();
    demoRef.current = null;
    pcmRef.current?.stop();
    pcmRef.current = null;
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
    setAmplitude(0);
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const startDemo = useCallback(() => {
    modeRef.current = 'demo';
    setConnection('demo');
    storeStart(`local-${Date.now()}`);
    demoRef.current = startDemoTranscript({ onSegment: upsertSegment, onAmplitude: setAmplitude });
  }, [storeStart, upsertSegment]);

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
          teardown();
          onSpecReady();
          break;
        default:
          break;
      }
    },
    [upsertSegment, setTranslation, setSpecProgress, setSpec, teardown, onSpecReady],
  );

  const startLive = useCallback(
    async (serverUrl: string) => {
      const api = new ApiClient(serverUrl);
      const { zeroRetention } = useAppStore.getState().settings;
      try {
        const { session } = await api.createSession({ userId: USER_ID, zeroRetention });
        const granted = await requestMicPermission();
        if (!granted) {
          startDemo();
          return;
        }

        modeRef.current = 'live';
        setConnection('live');
        storeStart(session.id);
        seqRef.current = 0;

        const ws = new WebSocket(api.wsUrl(session.id, USER_ID));
        wsRef.current = ws;
        ws.onmessage = (e) => {
          try {
            onMessage(JSON.parse(String(e.data)) as ServerMessage);
          } catch {
            /* ignore malformed frame */
          }
        };
        ws.onopen = () => {
          ws.send(
            JSON.stringify({ type: WsMessageType.StartSession, sessionId: session.id, sampleRate: 16000 }),
          );
          pcmRef.current = startPcmStream((base64) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: WsMessageType.AudioChunk,
                  sessionId: session.id,
                  seq: seqRef.current++,
                  data: base64,
                }),
              );
              // Lightweight reactive pulse for the waveform.
              setAmplitude(0.35 + Math.random() * 0.6);
            }
          });
        };
        ws.onerror = () => undefined;
      } catch {
        // Server unreachable — degrade gracefully to the on-device demo.
        startDemo();
      }
    },
    [onMessage, startDemo, storeStart],
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
      pcmRef.current?.stop();
      pcmRef.current = null;
      setAmplitude(0);
      const sessionId = useAppStore.getState().sessionId;
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: WsMessageType.StopSession, sessionId, generateSpec: true }),
        );
      }
      // Safety net: if the server never returns a spec, synthesize one locally.
      setTimeout(() => {
        if (useAppStore.getState().spec === null) {
          const segs = useAppStore.getState().segments;
          setSpec(generateDemoSpec(sessionId ?? `local-${Date.now()}`, segs));
          teardown();
          onSpecReady();
        }
      }, 15000);
      return;
    }

    // Demo mode: brief progress beat, then generate locally.
    teardown();
    setTimeout(() => {
      const segs = useAppStore.getState().segments;
      const sessionId = useAppStore.getState().sessionId ?? `local-${Date.now()}`;
      setSpec(generateDemoSpec(sessionId, segs));
      onSpecReady();
    }, 600);
  }, [onSpecReady, setSpec, setSpecProgress, stopRecording, teardown]);

  return { amplitude, connection, start, stop };
}
