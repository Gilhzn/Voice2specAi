import { FastifyInstance } from 'fastify';
import { maskPii } from '../services/piiService';

/**
 * Defence-in-depth hook: scrubs PII from inbound string fields of REST request
 * bodies before any handler stores or forwards them. The live transcript path
 * also masks per-segment in the pipeline; this guards the REST surface.
 */
export function registerPiiMasking(app: FastifyInstance): void {
  app.addHook('preHandler', async (req) => {
    if (req.body && typeof req.body === 'object') {
      maskObjectStrings(req.body as Record<string, unknown>);
    }
  });
}

function maskObjectStrings(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === 'string') {
      obj[key] = maskPii(value).text;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      maskObjectStrings(value as Record<string, unknown>);
    }
  }
}
