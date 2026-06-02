import { FastifyInstance } from 'fastify';
import {
  CreateSessionResponse,
  GenerateSpecResponse,
  HealthResponse,
} from '@voice2spec/shared-types';
import { buildApp } from '../src/app';
import { __resetRepositoryForTests } from '../src/models/db';
import { __resetSessionStoreForTests } from '../src/services/redisService';

/**
 * Integration test of the REST surface using Fastify's `inject` (no socket).
 * Covers the health probe, session creation, the PII-masking hook, and the
 * end-to-end spec-generation flow.
 */
describe('REST API (integration)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    __resetRepositoryForTests();
    __resetSessionStoreForTests();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('reports health with mock/in-memory services', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json<HealthResponse>();
    expect(body.status).toBe('ok');
    expect(body.services.whisper).toBe('mock');
    expect(body.services.claude).toBe('mock');
    expect(body.services.redis).toBe('memory');
    expect(body.services.database).toBe('memory');
  });

  it('creates a session and returns a ws url', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sessions',
      payload: { userId: 'rest-user' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<CreateSessionResponse>();
    expect(body.session.userId).toBe('rest-user');
    expect(body.wsUrl).toContain(body.session.id);
  });

  it('rejects session creation without userId', async () => {
    const res = await app.inject({ method: 'POST', url: '/sessions', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('masks PII in inbound request bodies', async () => {
    // userId carrying an email should be scrubbed by the preHandler hook.
    const res = await app.inject({
      method: 'POST',
      url: '/sessions',
      payload: { userId: 'gil@example.com' },
    });
    const body = res.json<CreateSessionResponse>();
    expect(body.session.userId).toBe('[REDACTED_EMAIL]');
  });

  it('generates a spec for an existing session', async () => {
    const created = (
      await app.inject({ method: 'POST', url: '/sessions', payload: { userId: 'spec-user' } })
    ).json<CreateSessionResponse>();

    const res = await app.inject({
      method: 'POST',
      url: '/spec',
      payload: { sessionId: created.session.id },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<GenerateSpecResponse>();
    expect(body.spec.sections.length).toBeGreaterThanOrEqual(8);
    expect(body.spec.model).toBe('mock');
  });

  it('returns 404 generating a spec for an unknown session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/spec',
      payload: { sessionId: 'does-not-exist' },
    });
    expect(res.statusCode).toBe(404);
  });
});
