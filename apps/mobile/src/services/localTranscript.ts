import { Language, SegmentCategory, SpecDocument, TranscriptSegment } from '@voice2spec/shared-types';

/**
 * On-device transcript helpers: language detection, light noise filtering, and
 * a content-aware specification generator that builds the document from the
 * user's actual recognized speech (no server required).
 */

const HEBREW = /[֐-׿]/;

export function detectLang(text: string): Language {
  let he = 0;
  let en = 0;
  for (const ch of text) {
    if (HEBREW.test(ch)) he++;
    else if (/[A-Za-z]/.test(ch)) en++;
  }
  if (he === 0 && en === 0) return Language.Auto;
  return he >= en ? Language.Hebrew : Language.English;
}

const SMALL_TALK =
  /\b(hi|hello|hey|thanks|thank you|bye|okay|ok|um+|uh+|yeah|coffee|lunch)\b|(שלום|תודה|אהה+|אמ+|כאילו|בוקר טוב|מה נשמע|קפה)/i;

/** Filter out very short fillers / greetings so the spec focuses on content. */
export function isNoise(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return true;
  const words = t.split(/\s+/);
  return words.length <= 3 && SMALL_TALK.test(t);
}

export function makeSegment(text: string, isFinal: boolean, id?: string): TranscriptSegment {
  const lang = detectLang(text);
  const filtered = isFinal ? isNoise(text) : false;
  return {
    id: id ?? `seg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    lang,
    text,
    translation: '',
    isFiltered: filtered,
    category: filtered ? SegmentCategory.SmallTalk : SegmentCategory.Engineering,
    ts: Date.now(),
    confidence: isFinal ? 0.9 : 0.4,
  };
}

const TECH_KEYWORDS = [
  'react',
  'react native',
  'node',
  'fastify',
  'express',
  'postgres',
  'mysql',
  'mongodb',
  'redis',
  'websocket',
  'api',
  'graphql',
  'docker',
  'kubernetes',
  'aws',
  'auth',
  'login',
  'payment',
  'stripe',
  'notification',
  'encryption',
  'cache',
  'queue',
  'ios',
  'android',
  'web',
  'dashboard',
  'admin',
];

/**
 * Build a specification Markdown document from the recognized transcript. Pulls
 * the engineering-relevant utterances and any technology mentions so the output
 * reflects what was actually said.
 */
export function generateLocalSpec(sessionId: string, segments: TranscriptSegment[]): SpecDocument {
  const kept = segments.filter((s) => !s.isFiltered && s.text.trim().length > 0);
  const transcript = kept.map((s) => s.text).join('\n');
  const lower = transcript.toLowerCase();
  const techMentioned = TECH_KEYWORDS.filter((k) => lower.includes(k));

  const bullets = kept.map((s) => `- ${s.text}`).join('\n') || '- (no speech captured)';
  const techList =
    techMentioned.length > 0
      ? techMentioned.map((t) => `- ${t}`).join('\n')
      : '- (none explicitly mentioned — choose per the requirements above)';

  const titles = [
    'Executive Summary & Core Product Value',
    'Captured Requirements (from your conversation)',
    'Complete Tech Stack Blueprint & Constraints',
    'Deep-Dive Directory Structure Layout',
    'Database Schema & State Management Strategy',
    'API & Integration Contracts',
    'Enterprise-Grade Security Implementation Details',
    'End-to-End QA, Testing Vectors, and Edge Cases',
  ];

  const bodies = [
    `Specification generated on-device from your spoken conversation (${kept.length} captured points).`,
    bullets,
    `Technologies mentioned in the conversation:\n${techList}\n\nRecommended baseline: React Native (mobile), Node.js + Fastify (backend), PostgreSQL + Redis.`,
    '```\napps/{mobile,server}\npackages/shared-types\n```',
    'Model the entities implied by the requirements above; persist with encryption at rest.',
    'Define REST/WebSocket contracts for each capability raised in the conversation.',
    'TLS in transit; AES-256-GCM at rest; PII masking; least-privilege access.',
    'Unit + integration + E2E coverage for every requirement listed above; enumerate edge cases.',
  ];

  const lines: string[] = ['# Voice2Spec AI — Specification (from your conversation)', ''];
  titles.forEach((t, i) => {
    lines.push(`## ${i + 1}. ${t}`, '', bodies[i], '');
  });
  lines.push('## Full Transcript', '', '```', transcript || '(empty)', '```', '');

  const markdown = lines.join('\n');
  return {
    id: `spec-${sessionId}`,
    sessionId,
    markdown,
    sections: [...titles, 'Full Transcript'],
    createdAt: Date.now(),
    model: 'on-device',
  };
}
