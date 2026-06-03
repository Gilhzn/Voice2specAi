import { randomUUID } from 'node:crypto';
import { Language, TranscriptSegment } from '@voice2spec/shared-types';
import { classifySegment } from './contextFilterService';
import { detectLanguage } from './languageService';
import { maskPii } from './piiService';
import { translate } from './translationService';

/**
 * Turns a raw recognized utterance into a fully-formed {@link TranscriptSegment}:
 * PII masking -> language detection -> classification (noise filter) ->
 * simultaneous translation. Filtered (non-engineering) segments skip translation.
 */
export async function buildSegment(
  rawText: string,
  langHint?: Language,
  confidence = 0.9,
): Promise<TranscriptSegment> {
  // Scrub PII before anything is stored, logged, or sent to a translation model.
  const text = maskPii(rawText).text;
  const lang = langHint && langHint !== Language.Auto ? langHint : detectLanguage(text);
  const decision = classifySegment(text, lang);
  const translation = decision.isFiltered ? '' : await translate(text, lang);

  return {
    id: randomUUID(),
    lang,
    text,
    translation,
    isFiltered: decision.isFiltered,
    category: decision.category,
    ts: Date.now(),
    confidence,
  };
}
