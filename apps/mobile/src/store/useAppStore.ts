import { create } from 'zustand';
import { RecordingState, SpecDocument, TranscriptSegment } from '@voice2spec/shared-types';

/**
 * Global app state. Holds the live recording state, the streamed transcript
 * segments, the generated spec, and user settings (Zero-Retention). Kept
 * framework-light so reducers are trivially unit-testable.
 */
export interface AppState {
  recordingState: RecordingState;
  sessionId: string | null;
  segments: TranscriptSegment[];
  spec: SpecDocument | null;
  specProgress: number;
  settings: {
    zeroRetention: boolean;
  };

  // Actions
  startRecording: (sessionId: string) => void;
  stopRecording: () => void;
  reset: () => void;
  upsertSegment: (segment: TranscriptSegment) => void;
  setTranslation: (segmentId: string, translation: string) => void;
  setSpecProgress: (progress: number) => void;
  setSpec: (spec: SpecDocument) => void;
  toggleZeroRetention: () => void;
}

const initialState = {
  recordingState: RecordingState.Idle,
  sessionId: null as string | null,
  segments: [] as TranscriptSegment[],
  spec: null as SpecDocument | null,
  specProgress: 0,
  settings: { zeroRetention: false },
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  startRecording: (sessionId) =>
    set({
      sessionId,
      recordingState: RecordingState.Recording,
      segments: [],
      spec: null,
      specProgress: 0,
    }),

  stopRecording: () => set({ recordingState: RecordingState.Generating }),

  reset: () => set({ ...initialState }),

  upsertSegment: (segment) =>
    set((state) => {
      const idx = state.segments.findIndex((s) => s.id === segment.id);
      if (idx === -1) return { segments: [...state.segments, segment] };
      const next = state.segments.slice();
      next[idx] = segment;
      return { segments: next };
    }),

  setTranslation: (segmentId, translation) =>
    set((state) => ({
      segments: state.segments.map((s) => (s.id === segmentId ? { ...s, translation } : s)),
    })),

  setSpecProgress: (progress) => set({ specProgress: progress }),

  setSpec: (spec) => set({ spec, recordingState: RecordingState.Idle, specProgress: 1 }),

  toggleZeroRetention: () =>
    set((state) => ({
      settings: { ...state.settings, zeroRetention: !state.settings.zeroRetention },
    })),
}));
