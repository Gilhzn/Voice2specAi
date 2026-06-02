import { Language } from '@voice2spec/shared-types';

const HEBREW_RANGE = /[֐-׿יִ-ﭏ]/;
const LATIN_RANGE = /[A-Za-z]/;

/** A contiguous run of text in a single script, used for code-switching splits. */
export interface LanguageSpan {
  lang: Language;
  text: string;
}

/** Returns true if the character belongs to the Hebrew Unicode blocks. */
export function isHebrewChar(ch: string): boolean {
  return HEBREW_RANGE.test(ch);
}

/** Returns true if the character is a Latin letter (treated as English). */
export function isLatinChar(ch: string): boolean {
  return LATIN_RANGE.test(ch);
}

/**
 * Detects the dominant language of a string by comparing Hebrew vs Latin
 * letter counts. Returns {@link Language.Auto} when there is no clear winner
 * (e.g. only punctuation/digits, or a near-even mix).
 */
export function detectLanguage(text: string): Language {
  let hebrew = 0;
  let latin = 0;
  for (const ch of text) {
    if (isHebrewChar(ch)) hebrew++;
    else if (isLatinChar(ch)) latin++;
  }
  if (hebrew === 0 && latin === 0) return Language.Auto;
  if (hebrew === 0) return Language.English;
  if (latin === 0) return Language.Hebrew;
  const total = hebrew + latin;
  // Require a 60% majority to declare a dominant language, else it's mixed.
  if (hebrew / total >= 0.6) return Language.Hebrew;
  if (latin / total >= 0.6) return Language.English;
  return Language.Auto;
}

/** True when a single utterance mixes Hebrew and English (code-switching). */
export function isCodeSwitching(text: string): boolean {
  let hebrew = 0;
  let latin = 0;
  for (const ch of text) {
    if (isHebrewChar(ch)) hebrew++;
    else if (isLatinChar(ch)) latin++;
  }
  return hebrew > 0 && latin > 0;
}

/**
 * Splits a code-switched utterance into contiguous single-language spans.
 * Whitespace and punctuation attach to the preceding span so word boundaries
 * are preserved. Useful for per-span translation.
 */
export function splitByLanguage(text: string): LanguageSpan[] {
  const spans: LanguageSpan[] = [];
  let current = '';
  let currentLang: Language | null = null;

  const flush = () => {
    if (current.length > 0 && currentLang !== null) {
      spans.push({ lang: currentLang, text: current });
    }
    current = '';
  };

  for (const ch of text) {
    let chLang: Language | null = null;
    if (isHebrewChar(ch)) chLang = Language.Hebrew;
    else if (isLatinChar(ch)) chLang = Language.English;

    if (chLang === null) {
      // Neutral characters (spaces, digits, punctuation) extend current span.
      current += ch;
      continue;
    }
    if (currentLang === null) {
      currentLang = chLang;
      current += ch;
    } else if (chLang === currentLang) {
      current += ch;
    } else {
      flush();
      currentLang = chLang;
      current = ch;
    }
  }
  flush();
  return spans.map((s) => ({ ...s, text: s.text.trim() })).filter((s) => s.text.length > 0);
}

/** The opposite language for translation purposes. */
export function targetLanguage(source: Language): Language {
  return source === Language.Hebrew ? Language.English : Language.Hebrew;
}
