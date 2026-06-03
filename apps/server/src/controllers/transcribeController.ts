import { FastifyInstance } from 'fastify';
import { transcribeAudio } from '../services/transcribeService';

/**
 * REST route that accepts a recorded audio file (multipart/form-data) plus a
 * `sessionId` (and optional `userId`) field, runs Whisper transcription and
 * Claude spec generation, and returns the transcript segments + spec.
 */
export async function transcribeController(app: FastifyInstance): Promise<void> {
  app.post('/transcribe', async (req, reply) => {
    const parts = req.parts();
    let audio: Buffer | null = null;
    let filename = 'audio.mp4';
    let sessionId = '';
    let userId = '';

    for await (const part of parts) {
      if (part.type === 'file') {
        filename = part.filename || filename;
        audio = await part.toBuffer();
      } else if (part.fieldname === 'sessionId') {
        sessionId = String(part.value);
      } else if (part.fieldname === 'userId') {
        userId = String(part.value);
      }
    }

    if (!audio || audio.length === 0) {
      return reply
        .status(400)
        .send({ error: 'BadRequest', message: 'audio file is required', statusCode: 400 });
    }
    if (!sessionId) {
      return reply
        .status(400)
        .send({ error: 'BadRequest', message: 'sessionId is required', statusCode: 400 });
    }

    const repo = await (await import('../models/db')).getRepository();
    const session = await repo.getSession(sessionId);
    const owner = userId || session?.userId || 'anonymous';

    const result = await transcribeAudio(owner, sessionId, audio, filename);
    return reply.send(result);
  });
}
