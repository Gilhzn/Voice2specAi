import { WsMessageType } from './enums';
import { SpecDocument, TranscriptSegment } from './dto';

/**
 * Discriminated-union WebSocket protocol for the live audio stream.
 * Every message carries `type` (a {@link WsMessageType}) as its discriminant.
 */

// ── Client -> Server ─────────────────────────────────────────────────────────

export interface StartSessionMessage {
  type: WsMessageType.StartSession;
  sessionId: string;
  /** Sample rate of the PCM/encoded audio the client will stream. */
  sampleRate: number;
}

export interface AudioChunkMessage {
  type: WsMessageType.AudioChunk;
  sessionId: string;
  /** Monotonic chunk sequence number; used to detect packet loss/reordering. */
  seq: number;
  /** Base64-encoded audio bytes for this chunk. */
  data: string;
}

export interface StopSessionMessage {
  type: WsMessageType.StopSession;
  sessionId: string;
  /** When true, the server generates the spec immediately on stop. */
  generateSpec: boolean;
}

export type ClientMessage = StartSessionMessage | AudioChunkMessage | StopSessionMessage;

// ── Server -> Client ─────────────────────────────────────────────────────────

export interface SessionStartedMessage {
  type: WsMessageType.SessionStarted;
  sessionId: string;
}

export interface TranscriptPartialMessage {
  type: WsMessageType.TranscriptPartial;
  sessionId: string;
  segment: TranscriptSegment;
}

export interface TranscriptFinalMessage {
  type: WsMessageType.TranscriptFinal;
  sessionId: string;
  segment: TranscriptSegment;
}

export interface TranslationMessage {
  type: WsMessageType.Translation;
  sessionId: string;
  segmentId: string;
  translation: string;
}

export interface SpecProgressMessage {
  type: WsMessageType.SpecProgress;
  sessionId: string;
  /** Progress in [0,1]. */
  progress: number;
  stage: string;
}

export interface SpecCompleteMessage {
  type: WsMessageType.SpecComplete;
  sessionId: string;
  spec: SpecDocument;
}

export interface ErrorMessage {
  type: WsMessageType.Error;
  sessionId?: string;
  code: string;
  message: string;
}

export type ServerMessage =
  | SessionStartedMessage
  | TranscriptPartialMessage
  | TranscriptFinalMessage
  | TranslationMessage
  | SpecProgressMessage
  | SpecCompleteMessage
  | ErrorMessage;

export type AnyWsMessage = ClientMessage | ServerMessage;
