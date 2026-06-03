import { TranscribeResponse } from '@voice2spec/shared-types';
import { getRepository } from '../models/db';
import { getWhisperService } from './whisperService';
import { buildSegment } from './segmentBuilder';
import { generateSpecForSession } from './specGenerator';

/**
 * Transcribes a complete recorded audio file for a session and produces the
 * specification:
 *   Whisper (file -> utterance segments) -> per-segment PII/lang/translate/filter
 *   -> persist -> Claude spec -> (optional) Zero-Retention purge.
 */
export async function transcribeAudio(
  userId: string,
  sessionId: string,
  audio: Buffer,
  filename: string,
): Promise<TranscribeResponse> {
  const repo = await getRepository();
  const session = await repo.getSession(sessionId);
  if (!session) {
    throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  }

  const { segments: rawSegments } = await getWhisperService().transcribeFile(audio, filename);

  // Build full segments (PII mask, language, translation, filter) in parallel.
  const segments = await Promise.all(rawSegments.map((s) => buildSegment(s.text)));

  // Persist each segment, then generate the spec from the stored transcript.
  for (let i = 0; i < segments.length; i++) {
    await repo.saveSegment(userId, sessionId, i, segments[i]);
  }
  const spec = await generateSpecForSession(userId, sessionId);

  const updated = (await repo.getSession(sessionId)) ?? session;
  return { session: updated, segments, spec };
}
