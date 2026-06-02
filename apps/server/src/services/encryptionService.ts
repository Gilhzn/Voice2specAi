import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { env } from '../config/env';

/**
 * Row-level encryption using AES-256-GCM. A per-user data key is derived from
 * the master key via HKDF with a per-user salt, so transcripts and specs are
 * encrypted under a key unique to each user (defence in depth).
 */

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;

/** Resolve the 32-byte master key from env, or a deterministic dev default. */
function masterKey(): Buffer {
  const raw = env.MASTER_ENCRYPTION_KEY;
  if (!raw) {
    // Dev-only fallback so the system runs without configuration. NEVER use in prod.
    return Buffer.alloc(KEY_LEN, 'voice2spec-dev-master-key-000000');
  }
  // Accept hex or base64; pad/truncate to 32 bytes deterministically.
  let buf: Buffer;
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0) {
    buf = Buffer.from(raw, 'hex');
  } else {
    buf = Buffer.from(raw, 'base64');
  }
  if (buf.length === KEY_LEN) return buf;
  const out = Buffer.alloc(KEY_LEN);
  buf.copy(out);
  return out;
}

/** Derive a per-user key from the master key and the user id (as salt). */
export function deriveUserKey(userId: string): Buffer {
  const salt = Buffer.from(`v2s:${userId}`);
  const derived = hkdfSync('sha256', masterKey(), salt, Buffer.from('row-encryption'), KEY_LEN);
  return Buffer.from(derived);
}

/** Compact wire format for an encrypted payload. */
export interface Encrypted {
  iv: string; // base64
  tag: string; // base64 auth tag
  ciphertext: string; // base64
}

/** Encrypt UTF-8 plaintext for a specific user. */
export function encryptForUser(userId: string, plaintext: string): Encrypted {
  const key = deriveUserKey(userId);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

/** Decrypt a payload previously produced by {@link encryptForUser}. */
export function decryptForUser(userId: string, payload: Encrypted): string {
  const key = deriveUserKey(userId);
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/** Serialize an {@link Encrypted} payload to a single string for DB storage. */
export function serializeEncrypted(e: Encrypted): string {
  return `${e.iv}.${e.tag}.${e.ciphertext}`;
}

/** Parse the string form produced by {@link serializeEncrypted}. */
export function deserializeEncrypted(s: string): Encrypted {
  const [iv, tag, ciphertext] = s.split('.');
  if (!iv || !tag || !ciphertext) {
    throw new Error('Malformed encrypted payload');
  }
  return { iv, tag, ciphertext };
}

/** Constant-time string comparison helper for tokens/secrets. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
