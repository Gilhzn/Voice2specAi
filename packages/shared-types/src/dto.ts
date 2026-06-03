import { Language, RecordingState, SegmentCategory } from './enums';

/** A single recognized utterance with its live translation. */
export interface TranscriptSegment {
  /** Stable identifier (monotonic per session). */
  id: string;
  /** Detected language of `text`. */
  lang: Language;
  /** Recognized text in the original language. */
  text: string;
  /** Simultaneous translation into the opposite language (he<->en). */
  translation: string;
  /** True once the context-filtering engine marks this as non-engineering noise. */
  isFiltered: boolean;
  /** Classification assigned by the context filter. */
  category: SegmentCategory;
  /** Epoch milliseconds when the segment was finalized. */
  ts: number;
  /** Confidence in [0,1] reported by the STT engine. */
  confidence: number;
}

/** High-level metadata for a recording session. */
export interface SessionMeta {
  id: string;
  userId: string;
  state: RecordingState;
  createdAt: number;
  updatedAt: number;
  /** When true, raw audio + transcript are purged after spec generation. */
  zeroRetention: boolean;
  segmentCount: number;
}

/** The generated engineering specification document. */
export interface SpecDocument {
  id: string;
  sessionId: string;
  /** Full Markdown body following the 8-section Blueprint Engine template. */
  markdown: string;
  /** Heading titles, in order, extracted from the Markdown for navigation. */
  sections: string[];
  createdAt: number;
  /** Model that produced the document, or "mock" when running offline. */
  model: string;
}

// ── REST contracts ─────────────────────────────────────────────────────────

export interface CreateSessionRequest {
  userId: string;
  zeroRetention?: boolean;
}

export interface CreateSessionResponse {
  session: SessionMeta;
  /** WebSocket URL the client should connect to for this session. */
  wsUrl: string;
}

export interface GetTranscriptResponse {
  session: SessionMeta;
  segments: TranscriptSegment[];
}

export interface GenerateSpecRequest {
  sessionId: string;
}

export interface GenerateSpecResponse {
  spec: SpecDocument;
}

/** Response from uploading a recorded audio file for transcription + spec. */
export interface TranscribeResponse {
  session: SessionMeta;
  segments: TranscriptSegment[];
  spec: SpecDocument;
}

export interface HealthResponse {
  status: 'ok';
  uptime: number;
  services: {
    whisper: 'live' | 'mock';
    claude: 'live' | 'mock';
    redis: 'live' | 'memory';
    database: 'live' | 'memory';
  };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
