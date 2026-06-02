import { containsPii, maskPii } from './piiService';

describe('piiService', () => {
  it('masks API key assignments', () => {
    const r = maskPii('set api_key = sk-abc123XYZ in config');
    expect(r.text).toContain('[REDACTED_SECRET]');
    expect(r.text).not.toContain('sk-abc123XYZ');
    expect(r.matched).toContain('api_key_assignment');
  });

  it('masks bearer tokens', () => {
    const r = maskPii('Authorization: Bearer eyJhbGciOiJIUzI1Ni.token here');
    expect(r.text).toContain('Bearer [REDACTED_SECRET]');
  });

  it('masks AWS access keys', () => {
    const r = maskPii('key AKIAIOSFODNN7EXAMPLE here');
    expect(r.text).toContain('[REDACTED_SECRET]');
    expect(r.text).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('masks emails', () => {
    const r = maskPii('contact me at gil@example.com please');
    expect(r.text).toContain('[REDACTED_EMAIL]');
    expect(r.matched).toContain('email');
  });

  it('masks credit card numbers', () => {
    const r = maskPii('card 4111 1111 1111 1111 on file');
    expect(r.text).toContain('[REDACTED_CARD]');
  });

  it('masks Israeli phone numbers', () => {
    const r = maskPii('call me on 054-123-4567 tomorrow');
    expect(r.text).toContain('[REDACTED_PHONE]');
  });

  it('masks PEM private key blocks', () => {
    const pem =
      '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----';
    const r = maskPii(`here is the key ${pem} done`);
    expect(r.text).toContain('[REDACTED_SECRET]');
    expect(r.text).not.toContain('MIIEowIBAAKCAQEA');
  });

  it('leaves clean engineering text untouched', () => {
    const text = 'We will use a Fastify backend with a WebSocket channel';
    expect(maskPii(text).text).toBe(text);
    expect(containsPii(text)).toBe(false);
  });

  it('containsPii detects sensitive content', () => {
    expect(containsPii('password = hunter2')).toBe(true);
  });
});
