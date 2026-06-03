import { TranscriptSegment } from '@voice2spec/shared-types';
import { buildSegment } from './segmentBuilder';
import { getWhisperService } from './whisperService';

/**
 * The per-chunk processing pipeline used by the WebSocket handler:
 *   audio chunk -> STT -> PII masking -> classification -> translation
 * producing a fully-formed {@link TranscriptSegment}.
 */
export async function processAudioChunk(audio: Buffer, seq: number): Promise<TranscriptSegment> {
  const stt = await getWhisperService().transcribeChunk(audio, seq);
  return buildSegment(stt.text, stt.lang, stt.confidence);
}
