import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  RecordingState,
  SessionMeta,
  SpecDocument,
  TranscriptSegment,
} from '@voice2spec/shared-types';
import { env } from '../config/env';
import {
  decryptForUser,
  deserializeEncrypted,
  encryptForUser,
  serializeEncrypted,
} from '../services/encryptionService';

/**
 * Persistence layer. Sessions hold clear metadata; transcript segments and
 * spec bodies are encrypted with the owning user's derived key before they
 * touch storage. A Postgres-backed repository is used when DATABASE_URL is set,
 * otherwise an in-memory repository keeps the server fully functional offline.
 */
export interface Repository {
  readonly mode: 'live' | 'memory';
  init(): Promise<void>;
  createUser(userId: string): Promise<void>;
  createSession(meta: SessionMeta): Promise<SessionMeta>;
  getSession(sessionId: string): Promise<SessionMeta | null>;
  updateSessionState(sessionId: string, state: RecordingState): Promise<void>;
  saveSegment(userId: string, sessionId: string, seq: number, seg: TranscriptSegment): Promise<void>;
  getSegments(userId: string, sessionId: string): Promise<TranscriptSegment[]>;
  saveSpec(userId: string, spec: SpecDocument): Promise<void>;
  getSpec(userId: string, sessionId: string): Promise<SpecDocument | null>;
  /** Zero-Retention purge: delete raw transcript + audio metadata for a session. */
  purgeRawData(sessionId: string): Promise<void>;
  close(): Promise<void>;
}

// ── In-memory repository ─────────────────────────────────────────────────────

class MemoryRepository implements Repository {
  readonly mode = 'memory' as const;
  private users = new Set<string>();
  private sessions = new Map<string, SessionMeta>();
  private segments = new Map<string, TranscriptSegment[]>();
  private specs = new Map<string, SpecDocument>();

  async init(): Promise<void> {
    /* nothing to migrate */
  }
  async createUser(userId: string): Promise<void> {
    this.users.add(userId);
  }
  async createSession(meta: SessionMeta): Promise<SessionMeta> {
    this.sessions.set(meta.id, meta);
    return meta;
  }
  async getSession(sessionId: string): Promise<SessionMeta | null> {
    return this.sessions.get(sessionId) ?? null;
  }
  async updateSessionState(sessionId: string, state: RecordingState): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (s) {
      s.state = state;
      s.updatedAt = Date.now();
    }
  }
  async saveSegment(
    _userId: string,
    sessionId: string,
    _seq: number,
    seg: TranscriptSegment,
  ): Promise<void> {
    const list = this.segments.get(sessionId) ?? [];
    list.push(seg);
    this.segments.set(sessionId, list);
    const s = this.sessions.get(sessionId);
    if (s) s.segmentCount = list.length;
  }
  async getSegments(_userId: string, sessionId: string): Promise<TranscriptSegment[]> {
    return [...(this.segments.get(sessionId) ?? [])];
  }
  async saveSpec(_userId: string, spec: SpecDocument): Promise<void> {
    this.specs.set(spec.sessionId, spec);
  }
  async getSpec(_userId: string, sessionId: string): Promise<SpecDocument | null> {
    return this.specs.get(sessionId) ?? null;
  }
  async purgeRawData(sessionId: string): Promise<void> {
    this.segments.delete(sessionId);
  }
  async close(): Promise<void> {
    this.sessions.clear();
    this.segments.clear();
    this.specs.clear();
    this.users.clear();
  }
}

// ── Postgres repository ──────────────────────────────────────────────────────

class PostgresRepository implements Repository {
  readonly mode = 'live' as const;
  private pool: import('pg').Pool;

  constructor(pool: import('pg').Pool) {
    this.pool = pool;
  }

  async init(): Promise<void> {
    const schema = readFileSync(join(__dirname, 'dbSchema.sql'), 'utf8');
    await this.pool.query(schema);
  }

  async createUser(userId: string): Promise<void> {
    await this.pool.query('INSERT INTO users(id) VALUES($1) ON CONFLICT DO NOTHING', [userId]);
  }

  async createSession(meta: SessionMeta): Promise<SessionMeta> {
    await this.pool.query(
      `INSERT INTO sessions(id, user_id, state, zero_retention, segment_count)
       VALUES($1,$2,$3,$4,$5)`,
      [meta.id, meta.userId, meta.state, meta.zeroRetention, meta.segmentCount],
    );
    return meta;
  }

  async getSession(sessionId: string): Promise<SessionMeta | null> {
    const { rows } = await this.pool.query(
      `SELECT id, user_id, state, zero_retention, segment_count, created_at, updated_at
       FROM sessions WHERE id=$1`,
      [sessionId],
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      state: r.state as RecordingState,
      zeroRetention: r.zero_retention,
      segmentCount: r.segment_count,
      createdAt: new Date(r.created_at).getTime(),
      updatedAt: new Date(r.updated_at).getTime(),
    };
  }

  async updateSessionState(sessionId: string, state: RecordingState): Promise<void> {
    await this.pool.query('UPDATE sessions SET state=$1, updated_at=now() WHERE id=$2', [
      state,
      sessionId,
    ]);
  }

  async saveSegment(
    userId: string,
    sessionId: string,
    seq: number,
    seg: TranscriptSegment,
  ): Promise<void> {
    const payload = serializeEncrypted(encryptForUser(userId, JSON.stringify(seg)));
    await this.pool.query(
      `INSERT INTO transcripts(id, session_id, seq, payload) VALUES($1,$2,$3,$4)`,
      [randomUUID(), sessionId, seq, payload],
    );
    await this.pool.query(
      'UPDATE sessions SET segment_count = segment_count + 1, updated_at=now() WHERE id=$1',
      [sessionId],
    );
  }

  async getSegments(userId: string, sessionId: string): Promise<TranscriptSegment[]> {
    const { rows } = await this.pool.query(
      'SELECT payload FROM transcripts WHERE session_id=$1 ORDER BY seq ASC',
      [sessionId],
    );
    return rows.map(
      (r) => JSON.parse(decryptForUser(userId, deserializeEncrypted(r.payload))) as TranscriptSegment,
    );
  }

  async saveSpec(userId: string, spec: SpecDocument): Promise<void> {
    const payload = serializeEncrypted(encryptForUser(userId, JSON.stringify(spec)));
    await this.pool.query(
      `INSERT INTO specs(id, session_id, model, payload) VALUES($1,$2,$3,$4)`,
      [spec.id, spec.sessionId, spec.model, payload],
    );
  }

  async getSpec(userId: string, sessionId: string): Promise<SpecDocument | null> {
    const { rows } = await this.pool.query(
      'SELECT payload FROM specs WHERE session_id=$1 ORDER BY created_at DESC LIMIT 1',
      [sessionId],
    );
    if (rows.length === 0) return null;
    return JSON.parse(decryptForUser(userId, deserializeEncrypted(rows[0].payload))) as SpecDocument;
  }

  async purgeRawData(sessionId: string): Promise<void> {
    await this.pool.query('DELETE FROM transcripts WHERE session_id=$1', [sessionId]);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

let instance: Repository | undefined;

/** Singleton accessor; Postgres when configured, else in-memory. */
export async function getRepository(): Promise<Repository> {
  if (instance) return instance;
  if (env.hasDatabase) {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: env.DATABASE_URL });
    instance = new PostgresRepository(pool);
  } else {
    instance = new MemoryRepository();
  }
  await instance.init();
  return instance;
}

/** Test helper: reset the singleton between test cases. */
export function __resetRepositoryForTests(): void {
  instance = undefined;
}
