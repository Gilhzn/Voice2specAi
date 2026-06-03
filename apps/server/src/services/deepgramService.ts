import { env } from '../config/env';

/**
 * Live (streaming) speech-to-text. With a Deepgram key configured this proxies
 * raw PCM audio to Deepgram's realtime API and surfaces interim + final
 * transcripts as they arrive (true word-by-word). Without a key it falls back
 * to a deterministic mock that emits a canned bilingual conversation, so the
 * streaming pipeline works offline and in tests. The Deepgram key never leaves
 * the server.
 */

export interface LiveTranscript {
  text: string;
  isFinal: boolean;
}

export interface LiveSttCallbacks {
  onTranscript: (t: LiveTranscript) => void;
  onError?: (err: unknown) => void;
}

export interface LiveSttSession {
  readonly mode: 'live' | 'mock';
  /** Feed a chunk of raw PCM (linear16, 16kHz mono) audio. */
  sendAudio: (audio: Buffer) => void;
  /** Flush and close the session; resolves once finalized. */
  finish: () => Promise<void>;
}

const MOCK_UTTERANCES: string[] = [
  'בוא נבנה אפליקציה שמקליטה שיחות ומפיקה אפיון טכני',
  'We should use a Fastify backend with WebSocket streaming',
  'um, yeah',
  'המסד נתונים יהיה PostgreSQL עם הצפנה ברמת השורה',
  'Actually, let me think — coffee first?',
  'The accent color should be electric teal, around 00F5D4',
  'נשתמש ב Redis בשביל ניהול תורי עיבוד השמע',
  "no, actually let's use a single WebSocket channel per session",
];

/**
 * Mock session: every Nth audio chunk it advances to the next canned utterance,
 * emitting an interim transcript then a final — deterministic and timer-free so
 * it is trivially testable and works with no external service.
 */
class MockLiveStt implements LiveSttSession {
  readonly mode = 'mock' as const;
  private index = 0;
  private chunkCount = 0;
  // Emit one utterance per N audio chunks to approximate natural pacing.
  private readonly chunksPerUtterance: number;

  constructor(private cb: LiveSttCallbacks, chunksPerUtterance = 1) {
    this.chunksPerUtterance = chunksPerUtterance;
  }

  sendAudio(_audio: Buffer): void {
    this.chunkCount += 1;
    if (this.chunkCount % this.chunksPerUtterance !== 0) return;
    const text = MOCK_UTTERANCES[this.index % MOCK_UTTERANCES.length];
    this.index += 1;
    this.cb.onTranscript({ text, isFinal: false });
    this.cb.onTranscript({ text, isFinal: true });
  }

  async finish(): Promise<void> {
    /* nothing to flush */
  }
}

class DeepgramLiveStt implements LiveSttSession {
  readonly mode = 'live' as const;
  // Loosely typed to avoid a hard compile dependency on the SDK's types here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private conn: any;
  private closed = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(conn: any) {
    this.conn = conn;
  }

  sendAudio(audio: Buffer): void {
    if (!this.closed) this.conn.send(audio);
  }

  async finish(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      // Ask Deepgram to flush remaining audio and close.
      if (typeof this.conn.requestClose === 'function') this.conn.requestClose();
      else if (typeof this.conn.finish === 'function') this.conn.finish();
    } catch {
      /* ignore */
    }
    // Give Deepgram a brief moment to emit trailing finals.
    await new Promise((r) => setTimeout(r, 600));
  }
}

/** Create a live STT session — Deepgram-backed when configured, else mock. */
export async function createLiveStt(cb: LiveSttCallbacks): Promise<LiveSttSession> {
  if (!env.hasDeepgram) {
    return new MockLiveStt(cb);
  }
  try {
    const { createClient, LiveTranscriptionEvents } = await import('@deepgram/sdk');
    const deepgram = createClient(env.DEEPGRAM_API_KEY as string);
    const conn = deepgram.listen.live({
      model: env.DEEPGRAM_MODEL,
      language: env.DEEPGRAM_LANGUAGE,
      smart_format: true,
      interim_results: true,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1,
    });

    conn.on(LiveTranscriptionEvents.Transcript, (data: unknown) => {
      const d = data as {
        is_final?: boolean;
        channel?: { alternatives?: Array<{ transcript?: string }> };
      };
      const text = d.channel?.alternatives?.[0]?.transcript ?? '';
      if (text.trim().length === 0) return;
      cb.onTranscript({ text, isFinal: Boolean(d.is_final) });
    });
    conn.on(LiveTranscriptionEvents.Error, (err: unknown) => cb.onError?.(err));

    // Wait until the socket is open before returning so early audio isn't dropped.
    await new Promise<void>((resolve) => {
      conn.on(LiveTranscriptionEvents.Open, () => resolve());
      // Safety: don't hang forever if Open is missed.
      setTimeout(resolve, 1500);
    });

    return new DeepgramLiveStt(conn);
  } catch (err) {
    cb.onError?.(err);
    return new MockLiveStt(cb);
  }
}
