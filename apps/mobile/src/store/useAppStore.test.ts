import { Language, RecordingState, SegmentCategory } from '@voice2spec/shared-types';
import { useAppStore } from './useAppStore';

const segment = (id: string, overrides = {}) => ({
  id,
  lang: Language.English,
  text: `text-${id}`,
  translation: '',
  isFiltered: false,
  category: SegmentCategory.Engineering,
  ts: 0,
  confidence: 1,
  ...overrides,
});

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.getState().reset();
  });

  it('starts recording with a clean transcript', () => {
    useAppStore.getState().upsertSegment(segment('old'));
    useAppStore.getState().startRecording('sess-1');
    const s = useAppStore.getState();
    expect(s.recordingState).toBe(RecordingState.Recording);
    expect(s.sessionId).toBe('sess-1');
    expect(s.segments).toHaveLength(0);
  });

  it('upserts segments by id (insert then update)', () => {
    useAppStore.getState().upsertSegment(segment('a', { text: 'first' }));
    useAppStore.getState().upsertSegment(segment('a', { text: 'updated' }));
    const s = useAppStore.getState();
    expect(s.segments).toHaveLength(1);
    expect(s.segments[0].text).toBe('updated');
  });

  it('sets a translation on the matching segment only', () => {
    useAppStore.getState().upsertSegment(segment('a'));
    useAppStore.getState().upsertSegment(segment('b'));
    useAppStore.getState().setTranslation('b', 'hello');
    const s = useAppStore.getState();
    expect(s.segments.find((x) => x.id === 'a')?.translation).toBe('');
    expect(s.segments.find((x) => x.id === 'b')?.translation).toBe('hello');
  });

  it('transitions to generating on stop', () => {
    useAppStore.getState().startRecording('sess-1');
    useAppStore.getState().stopRecording();
    expect(useAppStore.getState().recordingState).toBe(RecordingState.Generating);
  });

  it('returns to idle when the spec arrives', () => {
    useAppStore.getState().setSpec({
      id: 'spec-1',
      sessionId: 'sess-1',
      markdown: '# spec',
      sections: ['spec'],
      createdAt: 0,
      model: 'mock',
    });
    const s = useAppStore.getState();
    expect(s.recordingState).toBe(RecordingState.Idle);
    expect(s.spec?.id).toBe('spec-1');
    expect(s.specProgress).toBe(1);
  });

  it('toggles zero-retention', () => {
    expect(useAppStore.getState().settings.zeroRetention).toBe(false);
    useAppStore.getState().toggleZeroRetention();
    expect(useAppStore.getState().settings.zeroRetention).toBe(true);
  });
});
