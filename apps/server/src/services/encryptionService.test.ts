import {
  decryptForUser,
  deriveUserKey,
  deserializeEncrypted,
  encryptForUser,
  safeEqual,
  serializeEncrypted,
} from './encryptionService';

describe('encryptionService', () => {
  it('round-trips plaintext for a user', () => {
    const plaintext = 'מסמך אפיון סודי — secret spec';
    const enc = encryptForUser('user-1', plaintext);
    expect(enc.ciphertext).not.toContain('secret');
    const dec = decryptForUser('user-1', enc);
    expect(dec).toBe(plaintext);
  });

  it('produces different ciphertext for different users', () => {
    const a = encryptForUser('user-a', 'same text');
    const b = encryptForUser('user-b', 'same text');
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('uses a fresh IV per encryption', () => {
    const a = encryptForUser('user-1', 'hello');
    const b = encryptForUser('user-1', 'hello');
    expect(a.iv).not.toBe(b.iv);
  });

  it('fails to decrypt with the wrong user key', () => {
    const enc = encryptForUser('user-1', 'secret');
    expect(() => decryptForUser('user-2', enc)).toThrow();
  });

  it('detects tampering via the auth tag', () => {
    const enc = encryptForUser('user-1', 'secret');
    const tampered = { ...enc, ciphertext: Buffer.from('garbage').toString('base64') };
    expect(() => decryptForUser('user-1', tampered)).toThrow();
  });

  it('derives a stable 32-byte key per user', () => {
    const k1 = deriveUserKey('user-1');
    const k2 = deriveUserKey('user-1');
    expect(k1.length).toBe(32);
    expect(k1.equals(k2)).toBe(true);
  });

  it('serializes and deserializes payloads', () => {
    const enc = encryptForUser('user-1', 'payload');
    const round = deserializeEncrypted(serializeEncrypted(enc));
    expect(round).toEqual(enc);
    expect(decryptForUser('user-1', round)).toBe('payload');
  });

  it('rejects malformed serialized payloads', () => {
    expect(() => deserializeEncrypted('not-valid')).toThrow();
  });

  it('safeEqual compares constant-time', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
