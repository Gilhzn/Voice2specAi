/**
 * Active PII masking. A regex-based middleware layer that scrubs sensitive
 * material from transcripts before they are persisted, logged, or sent to any
 * external model. Each rule replaces matches with a sanitized tag.
 */

export interface PiiRule {
  name: string;
  pattern: RegExp;
  replacement: string;
}

/**
 * Ordered rules — more specific patterns first so they win over generic ones
 * (e.g. an API key assignment is masked before the bare-token rule sees it).
 */
export const PII_RULES: PiiRule[] = [
  {
    name: 'api_key_assignment',
    // key/token/secret/password = "value" or : value
    pattern:
      /\b(api[_-]?key|secret|token|password|passwd|pwd|access[_-]?key)\b\s*[:=]\s*["']?[^\s"']+["']?/gi,
    replacement: '$1=[REDACTED_SECRET]',
  },
  {
    name: 'bearer_token',
    pattern: /\bBearer\s+[A-Za-z0-9._-]+/g,
    replacement: 'Bearer [REDACTED_SECRET]',
  },
  {
    name: 'aws_access_key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    replacement: '[REDACTED_SECRET]',
  },
  {
    name: 'private_key_block',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: '[REDACTED_SECRET]',
  },
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: '[REDACTED_EMAIL]',
  },
  {
    name: 'credit_card',
    pattern: /\b(?:\d[ -]?){13,16}\b/g,
    replacement: '[REDACTED_CARD]',
  },
  {
    name: 'israeli_phone',
    pattern: /\b(?:\+972[-\s]?|0)(?:5\d|[2-4]|[7-9])[-\s]?\d{3}[-\s]?\d{4}\b/g,
    replacement: '[REDACTED_PHONE]',
  },
  {
    name: 'generic_phone',
    pattern: /\b\+?\d{1,3}[-\s]?\(?\d{2,4}\)?[-\s]?\d{3}[-\s]?\d{3,4}\b/g,
    replacement: '[REDACTED_PHONE]',
  },
];

export interface MaskResult {
  text: string;
  /** Names of rules that matched at least once. */
  matched: string[];
}

/** Masks all PII in `input`, returning the scrubbed text and which rules fired. */
export function maskPii(input: string): MaskResult {
  let text = input;
  const matched: string[] = [];
  for (const rule of PII_RULES) {
    // Reset lastIndex defensively since the patterns are global.
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(text)) {
      matched.push(rule.name);
      rule.pattern.lastIndex = 0;
      text = text.replace(rule.pattern, rule.replacement);
    }
  }
  return { text, matched };
}

/** Convenience predicate: does the text contain any detectable PII? */
export function containsPii(input: string): boolean {
  return maskPii(input).matched.length > 0;
}
