import { Language } from '@voice2spec/shared-types';
import {
  detectLanguage,
  isCodeSwitching,
  isHebrewChar,
  isLatinChar,
  splitByLanguage,
  targetLanguage,
} from './languageService';

describe('languageService', () => {
  describe('isHebrewChar / isLatinChar', () => {
    it('classifies Hebrew letters', () => {
      expect(isHebrewChar('ש')).toBe(true);
      expect(isHebrewChar('a')).toBe(false);
    });
    it('classifies Latin letters', () => {
      expect(isLatinChar('a')).toBe(true);
      expect(isLatinChar('Z')).toBe(true);
      expect(isLatinChar('ש')).toBe(false);
      expect(isLatinChar('5')).toBe(false);
    });
  });

  describe('detectLanguage', () => {
    it('detects pure Hebrew', () => {
      expect(detectLanguage('שלום עולם')).toBe(Language.Hebrew);
    });
    it('detects pure English', () => {
      expect(detectLanguage('hello world')).toBe(Language.English);
    });
    it('returns Auto for digits/punctuation only', () => {
      expect(detectLanguage('123 !!! ...')).toBe(Language.Auto);
    });
    it('returns Auto for a near-even mix', () => {
      expect(detectLanguage('שלום hello')).toBe(Language.Auto);
    });
    it('picks the 60% majority language', () => {
      expect(detectLanguage('database מסד נתונים שלנו פה')).toBe(Language.Hebrew);
      expect(detectLanguage('our database schema שרת')).toBe(Language.English);
    });
  });

  describe('isCodeSwitching', () => {
    it('is true when both scripts appear', () => {
      expect(isCodeSwitching('נשתמש ב WebSocket')).toBe(true);
    });
    it('is false for single-script text', () => {
      expect(isCodeSwitching('hello there')).toBe(false);
      expect(isCodeSwitching('שלום')).toBe(false);
    });
  });

  describe('splitByLanguage', () => {
    it('splits a code-switched utterance into spans', () => {
      const spans = splitByLanguage('נשתמש ב WebSocket מאובטח');
      expect(spans.length).toBeGreaterThanOrEqual(2);
      expect(spans.some((s) => s.lang === Language.Hebrew)).toBe(true);
      expect(spans.some((s) => s.lang === Language.English)).toBe(true);
    });
    it('returns a single span for monolingual text', () => {
      const spans = splitByLanguage('hello world');
      expect(spans).toHaveLength(1);
      expect(spans[0].lang).toBe(Language.English);
    });
    it('drops empty/neutral-only fragments', () => {
      const spans = splitByLanguage('   ---   ');
      expect(spans).toHaveLength(0);
    });
  });

  describe('targetLanguage', () => {
    it('maps Hebrew->English and English->Hebrew', () => {
      expect(targetLanguage(Language.Hebrew)).toBe(Language.English);
      expect(targetLanguage(Language.English)).toBe(Language.Hebrew);
    });
  });
});
