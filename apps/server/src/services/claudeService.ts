import { Language, SpecDocument, TranscriptSegment } from '@voice2spec/shared-types';
import { env } from '../config/env';

/**
 * The Blueprint Engine system prompt — verbatim from the architecture document
 * (section 7). It instructs Claude to transform a raw bilingual transcript into
 * a deep, machine-parseable Markdown architecture specification (PRD).
 */
export const BLUEPRINT_ENGINE_SYSTEM_PROMPT = `You are a Principal Software Architect and Elite Product Specification Engineer.
Your task is to transform the following raw, bilingual (Hebrew/English) conversation transcript into a highly structured, deep, comprehensive, and technical Markdown Architecture Specification Document (PRD).

The output must be optimized so that another instance of an AI Developer (specifically Claude Code) can parse it and immediately generate production-ready code with absolute clarity on every implementation detail.

Follow this exact structure for the output markdown:
1. Executive Summary & Core Product Value
2. Complete Tech Stack Blueprint & Constraints
3. Deep-Dive Directory Structure Layout
4. Database Schema (SQL/NoSQL precise models) & State Management Strategy
5. Comprehensive API & WebSocket Protocol Contracts
6. Enterprise-Grade Security Implementation Details (Encryption, PII scrubbing)
7. Advanced UI/UX Specification (Layout hierarchy, Theme tokens, Animations)
8. End-to-End QA, Testing Vectors, and Edge Cases Matrix

Ensure you resolve any contradictions found in the transcript by picking the final architectural choice made by the speakers. Do not summarize or skip sections; expand to absolute depth.`;

/** Section titles in the required output order; reused by the mock generator. */
export const SPEC_SECTION_TITLES = [
  'Executive Summary & Core Product Value',
  'Complete Tech Stack Blueprint & Constraints',
  'Deep-Dive Directory Structure Layout',
  'Database Schema & State Management Strategy',
  'Comprehensive API & WebSocket Protocol Contracts',
  'Enterprise-Grade Security Implementation Details',
  'Advanced UI/UX Specification',
  'End-to-End QA, Testing Vectors, and Edge Cases Matrix',
];

export interface ClaudeService {
  readonly mode: 'live' | 'mock';
  /** Generate a spec document from already-filtered transcript segments. */
  generateSpec(sessionId: string, segments: TranscriptSegment[]): Promise<SpecDocument>;
}

/** Build the user-message transcript block fed to the model. */
export function buildTranscriptBlock(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => {
      const speakerLang = s.lang === Language.Hebrew ? 'HE' : s.lang === Language.English ? 'EN' : '??';
      return `[${speakerLang}] ${s.text}`;
    })
    .join('\n');
}

/** Extract `# `/`## ` heading titles from a Markdown body, in order. */
export function extractSections(markdown: string): string[] {
  return markdown
    .split('\n')
    .filter((line) => /^#{1,3}\s+/.test(line))
    .map((line) => line.replace(/^#{1,3}\s+/, '').replace(/^\d+\.\s*/, '').trim());
}

class MockClaudeService implements ClaudeService {
  readonly mode = 'mock' as const;

  async generateSpec(sessionId: string, segments: TranscriptSegment[]): Promise<SpecDocument> {
    const transcript = buildTranscriptBlock(segments);
    const markdown = renderMockSpec(transcript);
    return {
      id: `spec_${sessionId}`,
      sessionId,
      markdown,
      sections: extractSections(markdown),
      createdAt: Date.now(),
      model: 'mock',
    };
  }
}

class LiveClaudeService implements ClaudeService {
  readonly mode = 'live' as const;
  private clientPromise?: Promise<unknown>;

  private async client() {
    if (!this.clientPromise) {
      this.clientPromise = import('@anthropic-ai/sdk').then(
        ({ default: Anthropic }) => new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }),
      );
    }
    return this.clientPromise;
  }

  async generateSpec(sessionId: string, segments: TranscriptSegment[]): Promise<SpecDocument> {
    const anthropic = (await this.client()) as {
      messages: {
        create: (args: Record<string, unknown>) => Promise<{
          content: Array<{ type: string; text?: string }>;
        }>;
      };
    };
    const transcript = buildTranscriptBlock(segments);
    const res = await anthropic.messages.create({
      model: env.CLAUDE_MODEL,
      max_tokens: 8000,
      system: BLUEPRINT_ENGINE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `<transcript>\n${transcript}\n</transcript>\n\nProduce the full Markdown specification now.`,
        },
      ],
    });
    const markdown = res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('\n');
    return {
      id: `spec_${sessionId}`,
      sessionId,
      markdown,
      sections: extractSections(markdown),
      createdAt: Date.now(),
      model: env.CLAUDE_MODEL,
    };
  }
}

/** Produce a structured 8-section Markdown spec deterministically (offline). */
function renderMockSpec(transcript: string): string {
  const lines: string[] = [];
  lines.push('# Voice2Spec AI — Generated Architecture Specification (PRD)');
  lines.push('');
  lines.push('> Generated offline by the deterministic mock engine. Wire `ANTHROPIC_API_KEY`');
  lines.push('> to produce this document with Claude.');
  lines.push('');
  SPEC_SECTION_TITLES.forEach((title, i) => {
    lines.push(`## ${i + 1}. ${title}`);
    lines.push('');
    lines.push(sectionBody(i, transcript));
    lines.push('');
  });
  return lines.join('\n');
}

function sectionBody(index: number, transcript: string): string {
  switch (index) {
    case 0:
      return 'Derived product value from the filtered transcript. The system records bilingual conversations and emits a deep technical PRD.';
    case 1:
      return '- Frontend: React Native (TypeScript) + Reanimated\n- Backend: Node.js + Fastify\n- Datastores: PostgreSQL, Redis\n- AI: OpenAI Whisper (STT), Anthropic Claude (spec generation)';
    case 2:
      return '```\napps/{mobile,server}\npackages/shared-types\n```';
    case 3:
      return 'Tables: users, sessions, transcripts (encrypted), specs (encrypted). State synced via Redis during live capture.';
    case 4:
      return 'REST: POST /sessions, GET /sessions/:id/transcript, POST /spec. WebSocket: start_session / audio_chunk / stop_session -> transcript_partial / transcript_final / translation / spec_complete.';
    case 5:
      return 'TLS 1.3 in transit; AES-256-GCM per-user row encryption at rest; regex PII masking ([REDACTED_SECRET]); Zero-Retention mode.';
    case 6:
      return 'True Black (#000000) background, Electric Teal (#00F5D4) accent, Rubik (HE) / Inter (EN), 60fps fluid transitions with typewriter transcript reveal.';
    case 7:
      return 'Unit (>=90% on parsers/lang/PII/encryption, Jest), Integration (WebSocket under network degradation + Redis sync), E2E (Detox happy path).';
    default:
      return `Transcript excerpt considered:\n\n\`\`\`\n${transcript.slice(0, 400)}\n\`\`\``;
  }
}

let instance: ClaudeService | undefined;

/** Singleton accessor that picks the live or mock implementation. */
export function getClaudeService(): ClaudeService {
  if (!instance) {
    instance = env.hasAnthropic ? new LiveClaudeService() : new MockClaudeService();
  }
  return instance;
}
