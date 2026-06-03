import { z } from 'zod';

/**
 * Centralized, validated configuration. Missing optional values (API keys,
 * datastore URLs) are tolerated and surfaced through capability flags so the
 * rest of the system can transparently fall back to mock/in-memory behaviour.
 */
const schema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  DEEPGRAM_API_KEY: z.string().optional(),
  WHISPER_MODEL: z.string().default('whisper-1'),
  CLAUDE_MODEL: z.string().default('claude-3-5-sonnet-latest'),
  DEEPGRAM_MODEL: z.string().default('nova-2'),
  /** Deepgram language; "multi" enables multilingual/code-switching where supported. */
  DEEPGRAM_LANGUAGE: z.string().default('multi'),
  MASTER_ENCRYPTION_KEY: z.string().optional(),
  ZERO_RETENTION_DEFAULT: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

const parsed = schema.parse(process.env);

export const env = {
  ...parsed,
  /** Whether a real OpenAI key is configured. */
  hasOpenAI: Boolean(parsed.OPENAI_API_KEY),
  /** Whether a real Anthropic key is configured. */
  hasAnthropic: Boolean(parsed.ANTHROPIC_API_KEY),
  /** Whether a Deepgram key is configured (enables real live streaming STT). */
  hasDeepgram: Boolean(parsed.DEEPGRAM_API_KEY),
  /** Whether a Redis connection is configured. */
  hasRedis: Boolean(parsed.REDIS_URL),
  /** Whether a Postgres connection is configured. */
  hasDatabase: Boolean(parsed.DATABASE_URL),
};

export type Env = typeof env;
