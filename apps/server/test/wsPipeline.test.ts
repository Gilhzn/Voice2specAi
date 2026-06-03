import { randomUUID } from 'node:crypto';
import {
  ClientMessage,
  RecordingState,
  ServerMessage,
  SessionMeta,
  WsMessageType,
} from '@voice2spec/shared-types';
import {
  __resetLiveSessionsForTests,
  handleClientMessage,
} from '../src/websockets/streamHandler';
import { __resetRepositoryForTests, getRepository } from '../src/models/db';
import { __resetSessionStoreForTests, getSessionStore } from '../src/services/redisService';

/**
 * Integration test of the live streaming WebSocket pipeline against the
 * in-memory Redis + repository fallbacks and the deterministic mock STT.
 * Exercises start -> stream chunks -> stop+generate, message ordering,
 * packet-gap detection, persistence, and Zero-Retention.
 */
describe('WebSocket streaming pipeline (integration)', () => {
  beforeEach(() => {
    __resetRepositoryForTests();
    __resetSessionStoreForTests();
    __resetLiveSessionsForTests();
  });

  async function seedSession(zeroRetention = false): Promise<SessionMeta> {
    const repo = await getRepository();
    const now = Date.now();
    const meta: SessionMeta = {
      id: randomUUID(),
      userId: 'user-1',
      state: RecordingState.Idle,
      createdAt: now,
      updatedAt: now,
      zeroRetention,
      segmentCount: 0,
    };
    await repo.createUser('user-1');
    await repo.createSession(meta);
    return meta;
  }

  function collector() {
    const messages: ServerMessage[] = [];
    return {
      socket: { send: (d: string) => messages.push(JSON.parse(d) as ServerMessage) },
      messages,
    };
  }

  const chunk = (sessionId: string, seq: number): ClientMessage => ({
    type: WsMessageType.AudioChunk,
    sessionId,
    seq,
    data: Buffer.from(`pcm-${seq}`).toString('base64'),
  });

  it('streams a transcript + translation per utterance with no loss', async () => {
    const session = await seedSession();
    const { socket, messages } = collector();

    await handleClientMessage(
      { type: WsMessageType.StartSession, sessionId: session.id, sampleRate: 16000 },
      'user-1',
      socket,
    );
    expect(messages[0].type).toBe(WsMessageType.SessionStarted);

    const chunkCount = 6;
    for (let seq = 0; seq < chunkCount; seq++) {
      await handleClientMessage(chunk(session.id, seq), 'user-1', socket);
    }

    const finals = messages.filter((m) => m.type === WsMessageType.TranscriptFinal);
    const translations = messages.filter((m) => m.type === WsMessageType.Translation);
    expect(finals).toHaveLength(chunkCount);
    expect(translations).toHaveLength(chunkCount);

    const store = await getSessionStore();
    const repo = await getRepository();
    expect(await store.getSegments(session.id)).toHaveLength(chunkCount);
    expect(await repo.getSegments('user-1', session.id)).toHaveLength(chunkCount);
  });

  it('emits a partial before the final for an utterance', async () => {
    const session = await seedSession();
    const { socket, messages } = collector();
    await handleClientMessage(
      { type: WsMessageType.StartSession, sessionId: session.id, sampleRate: 16000 },
      'user-1',
      socket,
    );
    await handleClientMessage(chunk(session.id, 0), 'user-1', socket);

    const partialIdx = messages.findIndex((m) => m.type === WsMessageType.TranscriptPartial);
    const finalIdx = messages.findIndex((m) => m.type === WsMessageType.TranscriptFinal);
    expect(partialIdx).toBeGreaterThanOrEqual(0);
    expect(finalIdx).toBeGreaterThan(partialIdx);
    // Interim and final share an id so the client updates in place.
    const partial = messages[partialIdx];
    const final = messages[finalIdx];
    if (partial.type === WsMessageType.TranscriptPartial && final.type === WsMessageType.TranscriptFinal) {
      expect(partial.segment.id).toBe(final.segment.id);
    }
  });

  it('detects a packet gap', async () => {
    const session = await seedSession();
    const { socket, messages } = collector();
    await handleClientMessage(chunk(session.id, 0), 'user-1', socket);
    await handleClientMessage(chunk(session.id, 5), 'user-1', socket);
    expect(messages.some((m) => m.type === WsMessageType.Error && m.code === 'PACKET_GAP')).toBe(true);
  });

  it('generates a spec on stop and reaches Idle state', async () => {
    const session = await seedSession();
    const { socket, messages } = collector();
    await handleClientMessage(
      { type: WsMessageType.StartSession, sessionId: session.id, sampleRate: 16000 },
      'user-1',
      socket,
    );
    for (let seq = 0; seq < 4; seq++) {
      await handleClientMessage(chunk(session.id, seq), 'user-1', socket);
    }
    await handleClientMessage(
      { type: WsMessageType.StopSession, sessionId: session.id, generateSpec: true },
      'user-1',
      socket,
    );

    const complete = messages.find((m) => m.type === WsMessageType.SpecComplete);
    expect(complete).toBeDefined();
    if (complete && complete.type === WsMessageType.SpecComplete) {
      expect(complete.spec.sections.length).toBeGreaterThanOrEqual(8);
    }
    const repo = await getRepository();
    expect((await repo.getSession(session.id))?.state).toBe(RecordingState.Idle);
  });

  it('purges raw transcript when zero-retention is enabled', async () => {
    const session = await seedSession(true);
    const { socket } = collector();
    await handleClientMessage(
      { type: WsMessageType.StartSession, sessionId: session.id, sampleRate: 16000 },
      'user-1',
      socket,
    );
    await handleClientMessage(chunk(session.id, 0), 'user-1', socket);
    await handleClientMessage(
      { type: WsMessageType.StopSession, sessionId: session.id, generateSpec: true },
      'user-1',
      socket,
    );
    const repo = await getRepository();
    expect(await repo.getSegments('user-1', session.id)).toHaveLength(0);
    expect(await repo.getSpec('user-1', session.id)).not.toBeNull();
  });
});
