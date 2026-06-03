import {
  Language,
  SegmentCategory,
  SpecDocument,
  TranscriptSegment,
} from '@voice2spec/shared-types';

/**
 * On-device demo engine.
 *
 * The downloadable APK ships without a backend, so the app runs fully offline:
 * pressing Start streams a canned bilingual (Hebrew/English) conversation into
 * the live transcript, and Stop produces the 8-section Markdown specification —
 * mirroring the server's mock pipeline, but entirely on the device.
 */

interface CannedUtterance {
  text: string;
  lang: Language;
  translation: string;
  isFiltered: boolean;
  category: SegmentCategory;
}

/** A short, realistic bilingual brainstorm with translations precomputed. */
const SCRIPT: CannedUtterance[] = [
  {
    text: 'בוא נבנה אפליקציה שמקליטה שיחות ומפיקה אפיון טכני',
    lang: Language.Hebrew,
    translation: "Let's build an app that records conversations and produces a technical spec",
    isFiltered: false,
    category: SegmentCategory.Engineering,
  },
  {
    text: 'We should use a Fastify backend with WebSocket streaming',
    lang: Language.English,
    translation: 'כדאי להשתמש ב-Fastify בצד שרת עם הזרמת WebSocket',
    isFiltered: false,
    category: SegmentCategory.Engineering,
  },
  {
    text: 'um, yeah',
    lang: Language.English,
    translation: 'אהм, כן',
    isFiltered: true,
    category: SegmentCategory.Filler,
  },
  {
    text: 'המסד נתונים יהיה PostgreSQL עם הצפנה ברמת השורה',
    lang: Language.Hebrew,
    translation: 'The database will be PostgreSQL with row-level encryption',
    isFiltered: false,
    category: SegmentCategory.Engineering,
  },
  {
    text: 'Actually, let me think — coffee first?',
    lang: Language.English,
    translation: 'רגע, תן לי לחשוב — קודם קפה?',
    isFiltered: true,
    category: SegmentCategory.SmallTalk,
  },
  {
    text: 'The accent color should be electric teal, around 00F5D4',
    lang: Language.English,
    translation: 'צבע הדגש יהיה טורקיז חשמלי, בערך 00F5D4',
    isFiltered: false,
    category: SegmentCategory.Engineering,
  },
  {
    text: 'נשתמש ב Redis בשביל ניהול תורי עיבוד השמע',
    lang: Language.Hebrew,
    translation: "We'll use Redis to manage the audio processing queues",
    isFiltered: false,
    category: SegmentCategory.Engineering,
  },
  {
    text: "no, actually let's use a single WebSocket channel per session",
    lang: Language.English,
    translation: 'לא, בעצם בוא נשתמש בערוץ WebSocket יחיד לכל סשן',
    isFiltered: false,
    category: SegmentCategory.Engineering,
  },
];

export interface DemoHandle {
  /** Stop streaming and release timers. */
  stop: () => void;
}

export interface DemoCallbacks {
  onSegment: (segment: TranscriptSegment) => void;
  onAmplitude: (amplitude: number) => void;
}

/**
 * Begins streaming the canned conversation. Emits one segment roughly every
 * `intervalMs`, and drives a live amplitude value for the waveform until
 * stopped or the script is exhausted.
 */
export function startDemoTranscript(
  { onSegment, onAmplitude }: DemoCallbacks,
  intervalMs = 1300,
): DemoHandle {
  let i = 0;
  const ampTimer = setInterval(() => onAmplitude(0.25 + Math.random() * 0.75), 80);

  const emit = () => {
    if (i >= SCRIPT.length) return;
    const u = SCRIPT[i];
    onSegment({
      id: `demo-${i}-${Date.now()}`,
      lang: u.lang,
      text: u.text,
      translation: u.translation,
      isFiltered: u.isFiltered,
      category: u.category,
      ts: Date.now(),
      confidence: 0.95,
    });
    i += 1;
  };

  emit(); // first segment immediately so the screen reacts at once
  const segTimer = setInterval(emit, intervalMs);

  return {
    stop: () => {
      clearInterval(segTimer);
      clearInterval(ampTimer);
      onAmplitude(0);
    },
  };
}

const SPEC_SECTION_TITLES = [
  'Executive Summary & Core Product Value',
  'Complete Tech Stack Blueprint & Constraints',
  'Deep-Dive Directory Structure Layout',
  'Database Schema & State Management Strategy',
  'Comprehensive API & WebSocket Protocol Contracts',
  'Enterprise-Grade Security Implementation Details',
  'Advanced UI/UX Specification',
  'End-to-End QA, Testing Vectors, and Edge Cases Matrix',
];

function sectionBody(index: number, transcript: string): string {
  switch (index) {
    case 0:
      return 'Records bilingual (Hebrew/English) brainstorms and emits a deep, machine-parseable technical PRD.';
    case 1:
      return '- Frontend: React Native (TypeScript) + Reanimated\n- Backend: Node.js + Fastify\n- Datastores: PostgreSQL, Redis\n- AI: OpenAI Whisper (STT), Anthropic Claude (spec generation)';
    case 2:
      return '```\napps/{mobile,server}\npackages/shared-types\n```';
    case 3:
      return 'Tables: users, sessions, transcripts (encrypted), specs (encrypted). Live state synced via Redis.';
    case 4:
      return 'REST: POST /sessions, GET /sessions/:id/transcript, POST /spec. WS: start_session / audio_chunk / stop_session -> transcript_partial / transcript_final / translation / spec_complete.';
    case 5:
      return 'TLS 1.3 in transit; AES-256-GCM per-user row encryption at rest; regex PII masking ([REDACTED_SECRET]); Zero-Retention mode.';
    case 6:
      return 'True Black (#000000) background, Electric Teal (#00F5D4) accent, Rubik (HE) / Inter (EN), 60fps transitions with a soft typewriter transcript reveal.';
    case 7:
      return 'Unit (>=90% on parsers/lang/PII/encryption, Jest), Integration (WebSocket + Redis), E2E (Detox happy path).';
    default:
      return `Transcript excerpt:\n\n\`\`\`\n${transcript.slice(0, 400)}\n\`\`\``;
  }
}

/** Builds the 8-section Markdown specification from the kept segments. */
export function generateDemoSpec(
  sessionId: string,
  segments: TranscriptSegment[],
): SpecDocument {
  const transcript = segments
    .filter((s) => !s.isFiltered)
    .map((s) => `[${s.lang === Language.Hebrew ? 'HE' : 'EN'}] ${s.text}`)
    .join('\n');

  const lines: string[] = [
    '# Voice2Spec AI — Generated Architecture Specification (PRD)',
    '',
    '> Generated on-device in offline demo mode.',
    '',
  ];
  SPEC_SECTION_TITLES.forEach((title, i) => {
    lines.push(`## ${i + 1}. ${title}`, '', sectionBody(i, transcript), '');
  });
  const markdown = lines.join('\n');

  return {
    id: `spec-${sessionId}`,
    sessionId,
    markdown,
    sections: SPEC_SECTION_TITLES,
    createdAt: Date.now(),
    model: 'on-device-demo',
  };
}
