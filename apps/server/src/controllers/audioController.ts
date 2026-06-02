import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import {
  CreateSessionRequest,
  CreateSessionResponse,
  GetTranscriptResponse,
  RecordingState,
  SessionMeta,
} from '@voice2spec/shared-types';
import { env } from '../config/env';
import { getRepository } from '../models/db';

/** REST routes for session lifecycle and transcript retrieval. */
export async function audioController(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CreateSessionRequest }>('/sessions', async (req, reply) => {
    const { userId, zeroRetention } = req.body ?? {};
    if (!userId) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'userId is required',
        statusCode: 400,
      });
    }
    const repo = await getRepository();
    await repo.createUser(userId);

    const now = Date.now();
    const meta: SessionMeta = {
      id: randomUUID(),
      userId,
      state: RecordingState.Idle,
      createdAt: now,
      updatedAt: now,
      zeroRetention: zeroRetention ?? env.ZERO_RETENTION_DEFAULT,
      segmentCount: 0,
    };
    await repo.createSession(meta);

    const res: CreateSessionResponse = {
      session: meta,
      wsUrl: `/ws?sessionId=${meta.id}&userId=${encodeURIComponent(userId)}`,
    };
    return reply.status(201).send(res);
  });

  app.get<{ Params: { id: string }; Querystring: { userId: string } }>(
    '/sessions/:id/transcript',
    async (req, reply) => {
      const repo = await getRepository();
      const session = await repo.getSession(req.params.id);
      if (!session) {
        return reply
          .status(404)
          .send({ error: 'NotFound', message: 'Session not found', statusCode: 404 });
      }
      const userId = req.query.userId ?? session.userId;
      const segments = await repo.getSegments(userId, req.params.id);
      const res: GetTranscriptResponse = { session, segments };
      return reply.send(res);
    },
  );
}
