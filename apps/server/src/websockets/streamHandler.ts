import { FastifyInstance } from 'fastify';
import {
  ClientMessage,
  RecordingState,
  ServerMessage,
  WsMessageType,
} from '@voice2spec/shared-types';
import { processAudioChunk } from '../services/pipeline';
import { getSessionStore } from '../services/redisService';
import { getRepository } from '../models/db';
import { generateSpecForSession } from '../services/specGenerator';

/** Type of a raw WebSocket connection's send-capable socket. */
interface Sendable {
  send(data: string): void;
}

/** Serialize and push a server message to the client. */
function send(socket: Sendable, msg: ServerMessage): void {
  socket.send(JSON.stringify(msg));
}

/**
 * Registers the `/ws` audio-streaming endpoint. The protocol is the
 * discriminated union defined in @voice2spec/shared-types. Each connection is
 * bound to a session (and its owning user) via query parameters.
 *
 * Exported separately as {@link handleClientMessage} so the integration tests
 * can exercise the full pipeline without a live socket.
 */
export async function streamHandler(app: FastifyInstance): Promise<void> {
  app.get('/ws', { websocket: true }, (connection, req) => {
    // @fastify/websocket v10 passes the raw ws WebSocket as the first argument.
    const ws = connection as unknown as {
      on(event: 'message', cb: (raw: Buffer) => void): void;
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
        send(socket, {
          type: WsMessageType.Error,
          code: 'BAD_JSON',
          message: 'Could not parse message',
        });
        return;
      }
      void handleClientMessage(msg, userId, socket);
    });
  });
}

/**
 * Core message handler — pure of any socket framework so it is unit/integration
 * testable. Returns once any async side effects (transcription, persistence,
 * spec generation) and outbound messages have been dispatched.
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
      send(socket, { type: WsMessageType.SessionStarted, sessionId: msg.sessionId });
      return;
    }

    case WsMessageType.AudioChunk: {
      // Detect packet loss / reordering by tracking the max sequence seen.
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

      const audio = Buffer.from(msg.data, 'base64');
      const segment = await processAudioChunk(audio, msg.seq);

      // Stream the partial immediately, then the final + translation.
      send(socket, { type: WsMessageType.TranscriptPartial, sessionId: msg.sessionId, segment });
      await store.appendSegment(msg.sessionId, segment);
      await repo.saveSegment(userId, msg.sessionId, msg.seq, segment);
      send(socket, { type: WsMessageType.TranscriptFinal, sessionId: msg.sessionId, segment });
      send(socket, {
        type: WsMessageType.Translation,
        sessionId: msg.sessionId,
        segmentId: segment.id,
        translation: segment.translation,
      });
      return;
    }

    case WsMessageType.StopSession: {
      await repo.updateSessionState(msg.sessionId, RecordingState.Generating);
      if (!msg.generateSpec) {
        await repo.updateSessionState(msg.sessionId, RecordingState.Idle);
        return;
      }
      send(socket, {
        type: WsMessageType.SpecProgress,
        sessionId: msg.sessionId,
        progress: 0.1,
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
      send(socket, {
        type: WsMessageType.Error,
        code: 'UNKNOWN_TYPE',
        message: `Unhandled message type`,
      });
    }
  }
}
