/**
 * Shared enumerations used across the mobile client and the Fastify server.
 * These are the canonical string unions for the Voice2Spec AI protocol.
 */

/** Spoken / written language of a transcript segment. */
export enum Language {
  Hebrew = 'he',
  English = 'en',
  /** Mixed within a single utterance (code-switching) or not yet determined. */
  Auto = 'auto',
}

/** The two hard recording states plus the transient generating state. */
export enum RecordingState {
  Idle = 'idle',
  Recording = 'recording',
  Generating = 'generating',
}

/** Message types exchanged over the audio-streaming WebSocket. */
export enum WsMessageType {
  // Client -> Server
  StartSession = 'start_session',
  AudioChunk = 'audio_chunk',
  StopSession = 'stop_session',
  // Server -> Client
  SessionStarted = 'session_started',
  TranscriptPartial = 'transcript_partial',
  TranscriptFinal = 'transcript_final',
  Translation = 'translation',
  SpecProgress = 'spec_progress',
  SpecComplete = 'spec_complete',
  Error = 'error',
}

/** Categories produced by the context-filtering engine. */
export enum SegmentCategory {
  Engineering = 'engineering',
  SmallTalk = 'small_talk',
  Interruption = 'interruption',
  Filler = 'filler',
}
