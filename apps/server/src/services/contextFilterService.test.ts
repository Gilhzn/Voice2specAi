import { Language, SegmentCategory } from '@voice2spec/shared-types';
import {
  classifySegment,
  filterConversation,
  resolveContradictions,
} from './contextFilterService';

describe('contextFilterService', () => {
  describe('classifySegment', () => {
    it('keeps engineering content', () => {
      const d = classifySegment('We should use a Redis queue for the audio buffer');
      expect(d.category).toBe(SegmentCategory.Engineering);
      expect(d.isFiltered).toBe(false);
    });

    it('keeps Hebrew engineering content', () => {
      const d = classifySegment('המסד נתונים יהיה PostgreSQL עם הצפנה');
      expect(d.category).toBe(SegmentCategory.Engineering);
      expect(d.isFiltered).toBe(false);
    });

    it('filters small talk', () => {
      const d = classifySegment('hey, how are you doing today?');
      expect(d.category).toBe(SegmentCategory.SmallTalk);
      expect(d.isFiltered).toBe(true);
    });

    it('filters Hebrew small talk', () => {
      const d = classifySegment('בוקר טוב, מה נשמע');
      expect(d.isFiltered).toBe(true);
    });

    it('filters short filler', () => {
      const d = classifySegment('um, yeah');
      expect(d.category).toBe(SegmentCategory.Filler);
      expect(d.isFiltered).toBe(true);
    });

    it('filters interruptions', () => {
      const d = classifySegment('hold on, can you repeat that?');
      expect(d.category).toBe(SegmentCategory.Interruption);
      expect(d.isFiltered).toBe(true);
    });

    it('filters empty text', () => {
      expect(classifySegment('   ').isFiltered).toBe(true);
    });

    it('engineering hints win over politeness', () => {
      const d = classifySegment('thanks — and the API endpoint should be POST /spec');
      expect(d.category).toBe(SegmentCategory.Engineering);
      expect(d.isFiltered).toBe(false);
    });

    it('accepts an explicit language argument', () => {
      const d = classifySegment('שירות הצפנה', Language.Hebrew);
      expect(d.isFiltered).toBe(false);
    });
  });

  describe('filterConversation', () => {
    it('removes noise and keeps engineering segments', () => {
      const segments = [
        { text: 'hi there!' },
        { text: 'We will build a Fastify WebSocket backend' },
        { text: 'um' },
        { text: 'The database is PostgreSQL' },
      ];
      const kept = filterConversation(segments);
      expect(kept.map((s) => s.text)).toEqual([
        'We will build a Fastify WebSocket backend',
        'The database is PostgreSQL',
      ]);
    });
  });

  describe('resolveContradictions', () => {
    it('drops a statement superseded by a correction', () => {
      const segments = [
        { text: 'Use MongoDB for storage' },
        { text: 'no, actually use PostgreSQL for storage' },
      ];
      const resolved = resolveContradictions(segments);
      expect(resolved).toHaveLength(1);
      expect(resolved[0].text).toContain('PostgreSQL');
    });

    it('keeps unrelated statements', () => {
      const segments = [{ text: 'Use Redis' }, { text: 'Use Fastify' }];
      expect(resolveContradictions(segments)).toHaveLength(2);
    });
  });
});
