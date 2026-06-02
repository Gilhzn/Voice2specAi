import { SpecDocument } from '@voice2spec/shared-types';
import { filterConversation } from './contextFilterService';
import { getClaudeService } from './claudeService';
import { getRepository } from '../models/db';

/**
 * Orchestrates final spec generation for a session:
 *   1. load all segments, 2. run the context filter, 3. ask Claude (or mock),
 *   4. persist the spec, 5. honour Zero-Retention by purging raw transcripts.
 */
export async function generateSpecForSession(
  userId: string,
  sessionId: string,
): Promise<SpecDocument> {
  const repo = await getRepository();
  const segments = await repo.getSegments(userId, sessionId);
  const filtered = filterConversation(segments);

  const spec = await getClaudeService().generateSpec(sessionId, filtered);
  await repo.saveSpec(userId, spec);

  const session = await repo.getSession(sessionId);
  if (session?.zeroRetention) {
    await repo.purgeRawData(sessionId);
  }
  return spec;
}
