import { Language } from '@voice2spec/shared-types';
import { env } from '../config/env';
import { detectLanguage } from './languageService';
import { getOpenAI } from './openaiClient';

/** Result of transcribing one audio chunk. */
export interface SttResult {
  text: string;
  lang: Language;
  confidence: number;
  isFinal: boolean;
}

/** Result of transcribing a whole recorded file. */
export interface FileTranscription {
  segments: { text: string }[];
  language?: string;
}

export interface WhisperService {
  readonly mode: 'live' | 'mock';
  /** Transcribe a single streamed audio chunk (raw bytes). */
  transcribeChunk(audio: Buffer, seq: number): Promise<SttResult>;
  /** Transcribe a complete recorded audio file into utterance segments. */
  transcribeFile(audio: Buffer, filename: string): Promise<FileTranscription>;
}

/**
 * Deterministic mock used when no OpenAI key is present. It returns a rotating
 * set of canned bilingual utterances so the full pipeline (transcript ->
 * translation -> filtering -> spec) can be exercised fully offline.
 */
const MOCK_UTTERANCES: string[] = [
  'בוא נבנה אפליקציה שמקליטה שיחות ומפיקה אפיון טכני',
  'We should use a Fastify backend with WebSocket streaming',
  'um, yeah',
  'המסד נתונים יהיה PostgreSQL עם הצפנה ברמת השורה',
  'Actually, let me think — coffee first?',
  'The accent color should be electric teal, around 00F5D4',
  'נשתמש ב Redis בשביל ניהול תורי עיבוד השמע',
  'no, actually let’s use a single WebSocket channel per session',
];

class MockWhisperService implements WhisperService {
  readonly mode = 'mock' as const;

  async transcribeChunk(_audio: Buffer, seq: number): Promise<SttResult> {
    const text = MOCK_UTTERANCES[seq % MOCK_UTTERANCES.length];
    return { text, lang: detectLanguage(text), confidence: 0.95, isFinal: true };
  }

  async transcribeFile(_audio: Buffer, _filename: string): Promise<FileTranscription> {
    return { segments: MOCK_UTTERANCES.map((text) => ({ text })), language: 'mixed' };
  }
}

class LiveWhisperService implements WhisperService {
  readonly mode = 'live' as const;

  async transcribeChunk(audio: Buffer, _seq: number): Promise<SttResult> {
    const openai = await getOpenAI();
    const file = new File([new Uint8Array(audio)], 'chunk.wav', { type: 'audio/wav' });
    const res = await openai.audio.transcriptions.create({
      file,
      model: env.WHISPER_MODEL,
      response_format: 'json',
    });
    const text = res.text ?? '';
    return { text, lang: detectLanguage(text), confidence: 0.9, isFinal: true };
  }

  async transcribeFile(audio: Buffer, filename: string): Promise<FileTranscription> {
    const openai = await getOpenAI();
    const file = new File([new Uint8Array(audio)], filename, { type: 'audio/mp4' });
    const res = await openai.audio.transcriptions.create({
      file,
      model: env.WHISPER_MODEL,
      // Verbose JSON yields per-utterance segments for a live-style transcript.
      response_format: 'verbose_json',
    });
    const segments =
      res.segments && res.segments.length > 0
        ? res.segments.map((s) => ({ text: s.text.trim() })).filter((s) => s.text.length > 0)
        : [{ text: (res.text ?? '').trim() }].filter((s) => s.text.length > 0);
    return { segments, language: res.language };
  }
}

let instance: WhisperService | undefined;

/** Singleton accessor that picks the live or mock implementation. */
export function getWhisperService(): WhisperService {
  if (!instance) {
    instance = env.hasOpenAI ? new LiveWhisperService() : new MockWhisperService();
  }
  return instance;
}
