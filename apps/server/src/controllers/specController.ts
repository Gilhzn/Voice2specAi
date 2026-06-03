import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import {
  GenerateSpecRequest,
  GenerateSpecResponse,
  HealthResponse,
  RecordingState,
  SessionMeta,
  TranscribeResponse,
} from '@voice2spec/shared-types';
import { env } from '../config/env';
import { getRepository } from '../models/db';
import { getSessionStore } from '../services/redisService';
import { getWhisperService } from '../services/whisperService';
import { getClaudeService } from '../services/claudeService';
import { generateSpecForSession } from '../services/specGenerator';
import { buildSegment } from '../services/segmentBuilder';

/** REST routes for spec generation and the service health probe. */
export async function specController(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    const repo = await getRepository();
    const store = await getSessionStore();
    const res: HealthResponse = {
      status: 'ok',
      uptime: process.uptime(),
      services: {
        whisper: getWhisperService().mode,
        claude: getClaudeService().mode,
        redis: store.mode,
        database: repo.mode,
      },
    };
    return res;
  });

  // Generate a spec from an already-transcribed conversation (on-device STT).
  app.post<{ Body: { userId?: string; texts?: string[]; zeroRetention?: boolean } }>(
    '/spec/from-text',
    async (req, reply) => {
      const { userId, texts, zeroRetention } = req.body ?? {};
      if (!Array.isArray(texts) || texts.length === 0) {
        return reply
          .status(400)
          .send({ error: 'BadRequest', message: 'texts[] is required', statusCode: 400 });
      }
      const owner = userId || 'anonymous';
      const repo = await getRepository();
      await repo.createUser(owner);

      const now = Date.now();
      const meta: SessionMeta = {
        id: randomUUID(),
        userId: owner,
        state: RecordingState.Generating,
        createdAt: now,
        updatedAt: now,
        zeroRetention: zeroRetention ?? env.ZERO_RETENTION_DEFAULT,
        segmentCount: 0,
      };
      await repo.createSession(meta);

      const segments = await Promise.all(texts.map((t) => buildSegment(String(t))));
      for (let i = 0; i < segments.length; i++) {
        await repo.saveSegment(owner, meta.id, i, segments[i]);
      }
      const spec = await generateSpecForSession(owner, meta.id);
      const session = (await repo.getSession(meta.id)) ?? meta;
      const res: TranscribeResponse = { session, segments, spec };
      return reply.send(res);
    },
  );

  app.post<{ Body: GenerateSpecRequest }>('/spec', async (req, reply) => {
    const { sessionId } = req.body ?? {};
    if (!sessionId) {
      return reply
        .status(400)
        .send({ error: 'BadRequest', message: 'sessionId is required', statusCode: 400 });
    }
    const repo = await getRepository();
    const session = await repo.getSession(sessionId);
    if (!session) {
      return reply
        .status(404)
        .send({ error: 'NotFound', message: 'Session not found', statusCode: 404 });
    }
    const spec = await generateSpecForSession(session.userId, sessionId);
    const res: GenerateSpecResponse = { spec };
    return reply.send(res);
  });

  app.get<{ Params: { id: string }; Querystring: { userId?: string } }>(
    '/spec/:id',
    async (req, reply) => {
      const repo = await getRepository();
      const session = await repo.getSession(req.params.id);
      if (!session) {
        return reply
          .status(404)
          .send({ error: 'NotFound', message: 'Session not found', statusCode: 404 });
      }
      const userId = req.query.userId ?? session.userId;
      const spec = await repo.getSpec(userId, req.params.id);
      if (!spec) {
        return reply
          .status(404)
          .send({ error: 'NotFound', message: 'Spec not generated yet', statusCode: 404 });
      }
      return reply.send({ spec });
    },
  );
}
