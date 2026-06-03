import { env } from '../config/env';

/**
 * Lazily-constructed shared OpenAI client. Imported dynamically so the SDK is
 * only loaded when a key is configured (mock paths never touch it).
 */
let clientPromise: Promise<unknown> | undefined;

export async function getOpenAI(): Promise<{
  audio: {
    transcriptions: {
      create: (args: Record<string, unknown>) => Promise<{
        text?: string;
        language?: string;
        segments?: Array<{ text: string }>;
      }>;
    };
  };
  chat: {
    completions: {
      create: (args: Record<string, unknown>) => Promise<{
        choices: Array<{ message?: { content?: string | null } }>;
      }>;
    };
  };
}> {
  if (!clientPromise) {
    clientPromise = import('openai').then(
      ({ default: OpenAI }) => new OpenAI({ apiKey: env.OPENAI_API_KEY }),
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return clientPromise as any;
}
