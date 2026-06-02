import { randomUUID } from 'node:crypto';
import { TranscriptSegment } from '@voice2spec/shared-types';
import { classifySegment } from './contextFilterService';
import { maskPii } from './piiService';
import { translate } from './translationService';
import { getWhisperService } from './whisperService';

/**
 * The per-chunk processing pipeline shared by the WebSocket handler:
 *   audio chunk -> STT -> PII masking -> classification -> translation
 * producing a fully-formed {@link TranscriptSegment}.
 */
export async function processAudioChunk(audio: Buffer, seq: number): Promise<TranscriptSegment> {
  const stt = await getWhisperService().transcribeChunk(audio, seq);

  // Scrub PII before anything is stored, logged, or translated.
  const masked = maskPii(stt.text).text;

  const decision = classifySegment(masked, stt.lang);
  const translation = translate(masked, stt.lang);

  return {
    id: randomUUID(),
    lang: stt.lang,
    text: masked,
    translation,
    isFiltered: decision.isFiltered,
    category: decision.category,
    ts: Date.now(),
    confidence: stt.confidence,
  };
}
