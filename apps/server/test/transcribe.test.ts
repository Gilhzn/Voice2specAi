import { randomUUID } from 'node:crypto';
import { RecordingState, SessionMeta } from '@voice2spec/shared-types';
import { transcribeAudio } from '../src/services/transcribeService';
import { __resetRepositoryForTests, getRepository } from '../src/models/db';
import { __resetSessionStoreForTests } from '../src/services/redisService';

/**
 * Integration test of the file-upload transcription path against the mock
 * Whisper + mock Claude + in-memory repository (no API keys / network).
 */
describe('transcribeAudio (integration, mock)', () => {
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

  it('transcribes a file into segments and generates a spec', async () => {
    const session = await seedSession();
    const result = await transcribeAudio('user-1', session.id, Buffer.from('fake-audio'), 'audio.mp4');

    expect(result.segments.length).toBeGreaterThan(0);
    // Mock returns bilingual utterances; some are engineering, some filtered.
    expect(result.segments.some((s) => !s.isFiltered)).toBe(true);
    expect(result.segments.some((s) => s.isFiltered)).toBe(true);
    expect(result.spec.sections.length).toBeGreaterThanOrEqual(8);
    expect(result.spec.markdown).toContain('Architecture Specification');
  });

  it('rejects an unknown session', async () => {
    await expect(
      transcribeAudio('user-1', 'does-not-exist', Buffer.from('x'), 'audio.mp4'),
    ).rejects.toThrow(/not found/i);
  });

  it('purges raw transcript under zero-retention but keeps the spec', async () => {
    const session = await seedSession(true);
    await transcribeAudio('user-1', session.id, Buffer.from('fake'), 'audio.mp4');
    const repo = await getRepository();
    expect(await repo.getSegments('user-1', session.id)).toHaveLength(0);
    expect(await repo.getSpec('user-1', session.id)).not.toBeNull();
  });
});
