import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import {
  ClientMessage,
  RecordingState,
  SegmentCategory,
  ServerMessage,
  TranscriptSegment,
  WsMessageType,
} from '@voice2spec/shared-types';
import { createLiveStt, LiveSttSession, LiveTranscript } from '../services/deepgramService';
import { buildSegment } from '../services/segmentBuilder';
import { detectLanguage } from '../services/languageService';
import { getSessionStore } from '../services/redisService';
import { getRepository } from '../models/db';
import { generateSpecForSession } from '../services/specGenerator';

interface Sendable {
  send(data: string): void;
}

function send(socket: Sendable, msg: ServerMessage): void {
  socket.send(JSON.stringify(msg));
}

/** Per-connection live transcription state. */
interface LiveState {
  stt: LiveSttSession;
  userId: string;
  sessionId: string;
  segIndex: number;
  currentUtteranceId: string | null;
  pending: Promise<void>[];
}

const liveSessions = new Map<string, LiveState>();

/**
 * Registers the `/ws` audio-streaming endpoint. Clients send raw PCM
 * (linear16, 16kHz mono) audio chunks; the server proxies them to a live STT
 * session (Deepgram when configured, else a deterministic mock) and streams
 * interim/final transcripts + translations back, then generates the spec with
 * Claude on stop.
 */
export async function streamHandler(app: FastifyInstance): Promise<void> {
  app.get('/ws', { websocket: true }, (connection, req) => {
    const ws = connection as unknown as {
      on(event: 'message', cb: (raw: Buffer) => void): void;
      on(event: 'close', cb: () => void): void;
      send(data: string): void;
    };
    const query = req.query as { sessionId?: string; userId?: string };
    const userId = query.userId ?? 'anonymous';
    const socket: Sendable = ws;

    ws.on('message', (raw: Buffer) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage;
      } catch {
        send(socket, { type: WsMessageType.Error, code: 'BAD_JSON', message: 'Could not parse message' });
        return;
      }
      void handleClientMessage(msg, userId, socket);
    });

    ws.on('close', () => {
      // Best-effort cleanup if the client disconnects mid-session.
      for (const [id, state] of liveSessions) {
        if (state.userId === userId) {
          void state.stt.finish();
          liveSessions.delete(id);
        }
      }
    });
  });
}

/** Build a lightweight interim segment (no translation/filtering yet). */
function interimSegment(id: string, text: string): TranscriptSegment {
  return {
    id,
    lang: detectLanguage(text),
    text,
    translation: '',
    isFiltered: false,
    category: SegmentCategory.Engineering,
    ts: Date.now(),
    confidence: 0.4,
  };
}

/**
 * Core message handler — framework-agnostic so it is unit/integration testable.
 */
export async function handleClientMessage(
  msg: ClientMessage,
  userId: string,
  socket: Sendable,
): Promise<void> {
  const store = await getSessionStore();
  const repo = await getRepository();

  switch (msg.type) {
    case WsMessageType.StartSession: {
      await repo.updateSessionState(msg.sessionId, RecordingState.Recording);

      const state: LiveState = {
        stt: undefined as unknown as LiveSttSession,
        userId,
        sessionId: msg.sessionId,
        segIndex: 0,
        currentUtteranceId: null,
        pending: [],
      };

      const onTranscript = (t: LiveTranscript) => {
        state.pending.push(processTranscript(t, state, socket, store, repo));
      };
      state.stt = await createLiveStt({
        onTranscript,
        onError: (err) =>
          send(socket, {
            type: WsMessageType.Error,
            sessionId: msg.sessionId,
            code: 'STT_ERROR',
            message: String((err as Error)?.message ?? err),
          }),
      });

      liveSessions.set(msg.sessionId, state);
      send(socket, { type: WsMessageType.SessionStarted, sessionId: msg.sessionId });
      return;
    }

    case WsMessageType.AudioChunk: {
      const maxSeq = await store.getMaxSeq(msg.sessionId);
      if (msg.seq > maxSeq + 1 && maxSeq >= 0) {
        send(socket, {
          type: WsMessageType.Error,
          sessionId: msg.sessionId,
          code: 'PACKET_GAP',
          message: `Detected gap: expected ${maxSeq + 1}, got ${msg.seq}`,
        });
      }
      await store.recordSeq(msg.sessionId, msg.seq);

      const state = liveSessions.get(msg.sessionId);
      if (state) {
        state.stt.sendAudio(Buffer.from(msg.data, 'base64'));
        // Deterministic for the mock path (which emits during sendAudio); a no-op
        // for real streaming, where transcripts arrive asynchronously via events.
        const pending = state.pending.splice(0);
        if (pending.length) await Promise.all(pending);
      }
      return;
    }

    case WsMessageType.StopSession: {
      const state = liveSessions.get(msg.sessionId);
      if (state) {
        await state.stt.finish();
        if (state.pending.length) await Promise.all(state.pending.splice(0));
        liveSessions.delete(msg.sessionId);
      }
      await repo.updateSessionState(msg.sessionId, RecordingState.Generating);

      if (!msg.generateSpec) {
        await repo.updateSessionState(msg.sessionId, RecordingState.Idle);
        return;
      }
      send(socket, {
        type: WsMessageType.SpecProgress,
        sessionId: msg.sessionId,
        progress: 0.15,
        stage: 'filtering transcript',
      });
      const spec = await generateSpecForSession(userId, msg.sessionId);
      send(socket, {
        type: WsMessageType.SpecProgress,
        sessionId: msg.sessionId,
        progress: 0.9,
        stage: 'finalizing',
      });
      send(socket, { type: WsMessageType.SpecComplete, sessionId: msg.sessionId, spec });
      await repo.updateSessionState(msg.sessionId, RecordingState.Idle);
      return;
    }

    default: {
      send(socket, { type: WsMessageType.Error, code: 'UNKNOWN_TYPE', message: 'Unhandled message type' });
    }
  }
}

/** Handle one transcript event: interim → partial; final → persisted segment. */
async function processTranscript(
  t: LiveTranscript,
  state: LiveState,
  socket: Sendable,
  store: Awaited<ReturnType<typeof getSessionStore>>,
  repo: Awaited<ReturnType<typeof getRepository>>,
): Promise<void> {
  if (!t.isFinal) {
    if (!state.currentUtteranceId) state.currentUtteranceId = randomUUID();
    send(socket, {
      type: WsMessageType.TranscriptPartial,
      sessionId: state.sessionId,
      segment: interimSegment(state.currentUtteranceId, t.text),
    });
    return;
  }

  const id = state.currentUtteranceId ?? randomUUID();
  state.currentUtteranceId = null;

  const segment = await buildSegment(t.text);
  segment.id = id; // keep the interim id so the client updates in place

  await store.appendSegment(state.sessionId, segment);
  await repo.saveSegment(state.userId, state.sessionId, state.segIndex++, segment);

  send(socket, { type: WsMessageType.TranscriptFinal, sessionId: state.sessionId, segment });
  send(socket, {
    type: WsMessageType.Translation,
    sessionId: state.sessionId,
    segmentId: segment.id,
    translation: segment.translation,
  });
}

/** Test helper: drop any lingering live sessions between test cases. */
export function __resetLiveSessionsForTests(): void {
  liveSessions.clear();
}
