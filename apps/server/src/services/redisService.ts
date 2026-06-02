import { TranscriptSegment } from '@voice2spec/shared-types';
import { env } from '../config/env';

/**
 * Session state + processing-queue store. Backed by Redis in production; falls
 * back to an in-memory implementation when REDIS_URL is unset so the server
 * (and the test suite) runs with no external dependency. The same interface is
 * used by the WebSocket stream handler regardless of backend.
 */
export interface SessionStateStore {
  readonly mode: 'live' | 'memory';
  appendSegment(sessionId: string, segment: TranscriptSegment): Promise<void>;
  getSegments(sessionId: string): Promise<TranscriptSegment[]>;
  /** Highest audio-chunk sequence seen; used to detect gaps/packet loss. */
  recordSeq(sessionId: string, seq: number): Promise<void>;
  getMaxSeq(sessionId: string): Promise<number>;
  clearSession(sessionId: string): Promise<void>;
  close(): Promise<void>;
}

class MemorySessionStore implements SessionStateStore {
  readonly mode = 'memory' as const;
  private segments = new Map<string, TranscriptSegment[]>();
  private maxSeq = new Map<string, number>();

  async appendSegment(sessionId: string, segment: TranscriptSegment): Promise<void> {
    const list = this.segments.get(sessionId) ?? [];
    list.push(segment);
    this.segments.set(sessionId, list);
  }

  async getSegments(sessionId: string): Promise<TranscriptSegment[]> {
    return [...(this.segments.get(sessionId) ?? [])];
  }

  async recordSeq(sessionId: string, seq: number): Promise<void> {
    const cur = this.maxSeq.get(sessionId) ?? -1;
    if (seq > cur) this.maxSeq.set(sessionId, seq);
  }

  async getMaxSeq(sessionId: string): Promise<number> {
    return this.maxSeq.get(sessionId) ?? -1;
  }

  async clearSession(sessionId: string): Promise<void> {
    this.segments.delete(sessionId);
    this.maxSeq.delete(sessionId);
  }

  async close(): Promise<void> {
    this.segments.clear();
    this.maxSeq.clear();
  }
}

class RedisSessionStore implements SessionStateStore {
  readonly mode = 'live' as const;
  // Typed loosely to avoid a hard compile-time dependency on ioredis types here.
  private redis: import('ioredis').Redis;

  constructor(redis: import('ioredis').Redis) {
    this.redis = redis;
  }

  private segKey(id: string) {
    return `v2s:session:${id}:segments`;
  }
  private seqKey(id: string) {
    return `v2s:session:${id}:maxseq`;
  }

  async appendSegment(sessionId: string, segment: TranscriptSegment): Promise<void> {
    await this.redis.rpush(this.segKey(sessionId), JSON.stringify(segment));
  }

  async getSegments(sessionId: string): Promise<TranscriptSegment[]> {
    const raw = await this.redis.lrange(this.segKey(sessionId), 0, -1);
    return raw.map((r) => JSON.parse(r) as TranscriptSegment);
  }

  async recordSeq(sessionId: string, seq: number): Promise<void> {
    // Lua-free monotonic max via WATCH-less optimistic set.
    const cur = await this.getMaxSeq(sessionId);
    if (seq > cur) await this.redis.set(this.seqKey(sessionId), String(seq));
  }

  async getMaxSeq(sessionId: string): Promise<number> {
    const v = await this.redis.get(this.seqKey(sessionId));
    return v === null ? -1 : Number(v);
  }

  async clearSession(sessionId: string): Promise<void> {
    await this.redis.del(this.segKey(sessionId), this.seqKey(sessionId));
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

let instance: SessionStateStore | undefined;

/** Singleton accessor; connects to Redis when configured, else in-memory. */
export async function getSessionStore(): Promise<SessionStateStore> {
  if (instance) return instance;
  if (env.hasRedis) {
    const { default: Redis } = await import('ioredis');
    const redis = new Redis(env.REDIS_URL as string, { lazyConnect: false });
    instance = new RedisSessionStore(redis);
  } else {
    instance = new MemorySessionStore();
  }
  return instance;
}

/** Test helper: reset the singleton (used to isolate test cases). */
export function __resetSessionStoreForTests(): void {
  instance = undefined;
}
