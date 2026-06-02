import { Language } from '@voice2spec/shared-types';
import { env } from '../config/env';
import { detectLanguage } from './languageService';

/** Result of transcribing one audio chunk. */
export interface SttResult {
  text: string;
  lang: Language;
  confidence: number;
  isFinal: boolean;
}

export interface WhisperService {
  readonly mode: 'live' | 'mock';
  /** Transcribe a single audio chunk (raw bytes). */
  transcribeChunk(audio: Buffer, seq: number): Promise<SttResult>;
}

/**
 * Deterministic mock used when no OpenAI key is present. It returns a rotating
 * set of canned bilingual utterances so the live pipeline (transcript ->
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
    return {
      text,
      lang: detectLanguage(text),
      confidence: 0.95,
      isFinal: true,
    };
  }
}

class LiveWhisperService implements WhisperService {
  readonly mode = 'live' as const;
  // The OpenAI client is created lazily to avoid importing the SDK in mock mode.
  private clientPromise?: Promise<unknown>;

  private async client() {
    if (!this.clientPromise) {
      this.clientPromise = import('openai').then(
        ({ default: OpenAI }) => new OpenAI({ apiKey: env.OPENAI_API_KEY }),
      );
    }
    return this.clientPromise;
  }

  async transcribeChunk(audio: Buffer, _seq: number): Promise<SttResult> {
    const openai = (await this.client()) as {
      audio: {
        transcriptions: {
          create: (args: Record<string, unknown>) => Promise<{ text: string }>;
        };
      };
    };
    // Wrap raw bytes as a File-like object accepted by the SDK.
    const file = new File([new Uint8Array(audio)], `chunk.webm`, { type: 'audio/webm' });
    const res = await openai.audio.transcriptions.create({
      file,
      model: env.WHISPER_MODEL,
      // Whisper auto-detects he/en; omit `language` to allow code-switching.
      response_format: 'json',
    });
    const text = res.text ?? '';
    return { text, lang: detectLanguage(text), confidence: 0.9, isFinal: true };
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
