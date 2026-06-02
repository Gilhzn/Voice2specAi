import { Language } from '@voice2spec/shared-types';
import { splitByLanguage, targetLanguage } from './languageService';

/**
 * Simultaneous translation. The production path would call a translation model;
 * for offline/mock operation we annotate each language span so the live UI has
 * something deterministic to render. Code-switched utterances are translated
 * span-by-span and recombined, preserving order.
 */
export function translate(text: string, source: Language): string {
  const spans = splitByLanguage(text);
  if (spans.length <= 1) {
    return mockTranslateSpan(text, source);
  }
  return spans.map((s) => mockTranslateSpan(s.text, s.lang)).join(' ');
}

function mockTranslateSpan(text: string, source: Language): string {
  const target = targetLanguage(source);
  const tag = target === Language.Hebrew ? 'HE' : 'EN';
  // Deterministic placeholder translation that is obviously a translation.
  return `⟨${tag}: ${text}⟩`;
}
