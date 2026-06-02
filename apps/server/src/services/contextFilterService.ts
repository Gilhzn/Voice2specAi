import { Language, SegmentCategory } from '@voice2spec/shared-types';

/**
 * Context Filtering Engine.
 *
 * Removes utterances that carry no engineering value (greetings, small-talk,
 * fillers, interruptions) and resolves contradictions across a sliding window
 * of the conversation. The production path can defer to a fast LLM; this module
 * provides the deterministic heuristic core that is also used as the offline
 * mock and is the unit-tested source of truth for classification.
 */

const FILLER_WORDS_EN = [
  'um',
  'uh',
  'erm',
  'like',
  'you know',
  'i mean',
  'basically',
  'actually',
  'so yeah',
];
const FILLER_WORDS_HE = ['אהh', 'אהה', 'אמ', 'כאילו', 'יעני', 'בקיצור', 'אתה יודע'];

const SMALL_TALK_PATTERNS = [
  /\b(hi|hello|hey|good morning|good afternoon|how are you|nice to meet|thanks|thank you|bye|goodbye)\b/i,
  /\b(coffee|lunch|weekend|weather|tired|busy)\b/i,
  /(שלום|בוקר טוב|מה נשמע|מה קורה|תודה|להתראות|ביי|קפה|ארוחת)/,
];

const INTERRUPTION_PATTERNS = [
  /\b(hold on|wait|sorry|one sec|excuse me|can you repeat)\b/i,
  /(רגע|סליחה|שנייה|תחזור על זה)/,
];

const ENGINEERING_HINTS = [
  /\b(api|database|schema|endpoint|websocket|encryption|component|architecture|service|deploy|cache|queue|token|auth|frontend|backend|latency|redis|postgres)\b/i,
  /(שרת|מסד נתונים|הצפנה|רכיב|ארכיטקטורה|שירות|תור|מטמון|אבטחה|ממשק)/,
];

export interface FilterDecision {
  category: SegmentCategory;
  /** True when the segment should be excluded from the spec input. */
  isFiltered: boolean;
  /** Confidence in [0,1] of the classification. */
  confidence: number;
}

/** Classify a single utterance using deterministic heuristics. */
export function classifySegment(text: string, _lang: Language = Language.Auto): FilterDecision {
  const normalized = text.trim().toLowerCase();

  if (normalized.length === 0) {
    return { category: SegmentCategory.Filler, isFiltered: true, confidence: 1 };
  }

  // Engineering content always wins — even if it contains a polite word.
  if (ENGINEERING_HINTS.some((re) => re.test(text))) {
    return { category: SegmentCategory.Engineering, isFiltered: false, confidence: 0.9 };
  }

  // Pure filler: very short and dominated by filler tokens. Strip surrounding
  // punctuation so "um," still matches the "um" filler token.
  const words = normalized.split(/\s+/).map((w) => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ''));
  const fillerHits = words.filter(
    (w) => FILLER_WORDS_EN.includes(w) || FILLER_WORDS_HE.includes(w),
  ).length;
  if (words.length <= 3 && fillerHits > 0) {
    return { category: SegmentCategory.Filler, isFiltered: true, confidence: 0.8 };
  }

  if (INTERRUPTION_PATTERNS.some((re) => re.test(text))) {
    return { category: SegmentCategory.Interruption, isFiltered: true, confidence: 0.75 };
  }

  if (SMALL_TALK_PATTERNS.some((re) => re.test(text))) {
    return { category: SegmentCategory.SmallTalk, isFiltered: true, confidence: 0.7 };
  }

  // Default: keep it. Substantive sentences are assumed engineering-relevant.
  return { category: SegmentCategory.Engineering, isFiltered: false, confidence: 0.6 };
}

export interface FilterableSegment {
  text: string;
  lang?: Language;
}

/**
 * Filter a list of segments, returning only the engineering-relevant ones.
 * Also performs naive contradiction resolution: when two kept segments differ
 * only by a "no, actually" style correction, the later one supersedes.
 */
export function filterConversation<T extends FilterableSegment>(segments: T[]): T[] {
  const kept = segments.filter((s) => !classifySegment(s.text, s.lang).isFiltered);
  return resolveContradictions(kept);
}

const CORRECTION_MARKERS =
  /\b(no,? actually|scratch that|let's use instead|change that to|i meant)\b|(לא,? בעצם|בוא נשתמש במקום|תשנה את זה)/i;

/**
 * When a segment is explicitly a correction of an earlier statement, drop the
 * superseded one. The heuristic keeps the most recent decision the speakers made.
 */
export function resolveContradictions<T extends FilterableSegment>(segments: T[]): T[] {
  const result: T[] = [];
  for (const seg of segments) {
    if (CORRECTION_MARKERS.test(seg.text) && result.length > 0) {
      // The previous substantive statement is overridden by this correction.
      result.pop();
    }
    result.push(seg);
  }
  return result;
}
