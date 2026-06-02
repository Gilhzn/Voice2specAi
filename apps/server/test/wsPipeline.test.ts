import { randomUUID } from 'node:crypto';
import {
  ClientMessage,
  RecordingState,
  ServerMessage,
  SessionMeta,
  WsMessageType,
} from '@voice2spec/shared-types';
import { handleClientMessage } from '../src/websockets/streamHandler';
import { __resetRepositoryForTests, getRepository } from '../src/models/db';
import { __resetSessionStoreForTests, getSessionStore } from '../src/services/redisService';

/**
 * Integration test of the live WebSocket pipeline against the in-memory Redis +
 * repository fallbacks and the mock STT/Claude services. Exercises the full
 * path: start -> stream chunks -> stop+generate, and asserts message ordering,
 * packet-gap detection, and that no segments are lost.
 */
describe('WebSocket stream pipeline (integration)', () => {
  beforeEach(() => {
    __resetRepositoryForTests();
    __resetSessionStoreForTests();
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

  it('streams transcript + translation for each chunk with no loss', async () => {
    const session = await seedSession();
    const { socket, messages } = collector();

    const start: ClientMessage = {
      type: WsMessageType.StartSession,
      sessionId: session.id,
      sampleRate: 16000,
    };
    await handleClientMessage(start, 'user-1', socket);

    const chunkCount = 6;
    for (let seq = 0; seq < chunkCount; seq++) {
      const msg: ClientMessage = {
        type: WsMessageType.AudioChunk,
        sessionId: session.id,
        seq,
        data: Buffer.from(`audio-${seq}`).toString('base64'),
      };
      await handleClientMessage(msg, 'user-1', socket);
    }

    expect(messages[0].type).toBe(WsMessageType.SessionStarted);

    const finals = messages.filter((m) => m.type === WsMessageType.TranscriptFinal);
    const translations = messages.filter((m) => m.type === WsMessageType.Translation);
    expect(finals).toHaveLength(chunkCount);
    expect(translations).toHaveLength(chunkCount);

    // All segments persisted to both the session store and the repository.
    const store = await getSessionStore();
    const repo = await getRepository();
    expect(await store.getSegments(session.id)).toHaveLength(chunkCount);
    expect(await repo.getSegments('user-1', session.id)).toHaveLength(chunkCount);
  });

  it('emits a partial before the final for each chunk', async () => {
    const session = await seedSession();
    const { socket, messages } = collector();
    await handleClientMessage(
      { type: WsMessageType.StartSession, sessionId: session.id, sampleRate: 16000 },
      'user-1',
      socket,
    );
    await handleClientMessage(
      {
        type: WsMessageType.AudioChunk,
        sessionId: session.id,
        seq: 0,
        data: Buffer.from('x').toString('base64'),
      },
      'user-1',
      socket,
    );
    const partialIdx = messages.findIndex((m) => m.type === WsMessageType.TranscriptPartial);
    const finalIdx = messages.findIndex((m) => m.type === WsMessageType.TranscriptFinal);
    expect(partialIdx).toBeGreaterThanOrEqual(0);
    expect(finalIdx).toBeGreaterThan(partialIdx);
  });

  it('detects a packet gap', async () => {
    const session = await seedSession();
    const { socket, messages } = collector();
    await handleClientMessage(
      { type: WsMessageType.AudioChunk, sessionId: session.id, seq: 0, data: 'AA==' },
      'user-1',
      socket,
    );
    // Skip seq 1, jump to seq 5 -> gap.
    await handleClientMessage(
      { type: WsMessageType.AudioChunk, sessionId: session.id, seq: 5, data: 'AA==' },
      'user-1',
      socket,
    );
    expect(messages.some((m) => m.type === WsMessageType.Error && m.code === 'PACKET_GAP')).toBe(
      true,
    );
  });

  it('generates a spec on stop and reaches Idle state', async () => {
    const session = await seedSession();
    const { socket, messages } = collector();
    for (let seq = 0; seq < 4; seq++) {
      await handleClientMessage(
        {
          type: WsMessageType.AudioChunk,
          sessionId: session.id,
          seq,
          data: Buffer.from(`a${seq}`).toString('base64'),
        },
        'user-1',
        socket,
      );
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
      expect(complete.spec.markdown).toContain('Architecture Specification');
    }
    const repo = await getRepository();
    expect((await repo.getSession(session.id))?.state).toBe(RecordingState.Idle);
  });

  it('purges raw transcript when zero-retention is enabled', async () => {
    const session = await seedSession(true);
    const { socket } = collector();
    await handleClientMessage(
      {
        type: WsMessageType.AudioChunk,
        sessionId: session.id,
        seq: 0,
        data: Buffer.from('a').toString('base64'),
      },
      'user-1',
      socket,
    );
    await handleClientMessage(
      { type: WsMessageType.StopSession, sessionId: session.id, generateSpec: true },
      'user-1',
      socket,
    );
    const repo = await getRepository();
    expect(await repo.getSegments('user-1', session.id)).toHaveLength(0);
    // Spec itself is retained.
    expect(await repo.getSpec('user-1', session.id)).not.toBeNull();
  });
});
