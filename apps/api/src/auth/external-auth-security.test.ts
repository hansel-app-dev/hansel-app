import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createExternalAuthSecurity } from './external-auth-security.js';

describe('external auth transaction security [user-login REQ-014, REQ-018]', () => {
  it('uses keyed digests and authenticated encryption for transient secrets', () => {
    const security = createExternalAuthSecurity('k'.repeat(32));
    const sealed = security.seal({ nonce: 'nonce', codeVerifier: 'verifier' });

    expect(sealed).not.toContain('nonce');
    expect(security.unseal(sealed)).toEqual({
      nonce: 'nonce',
      codeVerifier: 'verifier',
    });
    expect(security.digest('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(security.createState()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(security.createNonce()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(security.createCodeVerifier()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('rejects modified and malformed encrypted values', () => {
    const security = createExternalAuthSecurity('k'.repeat(32));
    const sealed = security.seal({ nonce: 'nonce', codeVerifier: 'verifier' });
    const parts = sealed.split('.');
    const authenticationTag = parts[2];
    if (!authenticationTag) throw new Error('Missing authentication tag');
    parts[2] = `${authenticationTag.startsWith('A') ? 'B' : 'A'}${authenticationTag.slice(1)}`;
    expect(() => security.unseal(parts.join('.'))).toThrow();
    expect(() => security.unseal('not-a-valid-envelope')).toThrow();
    expect(() => security.unseal('AA.AA.AA')).toThrow(
      'Invalid external authorization transaction',
    );

    const invalidShape = security.seal({
      nonce: 'nonce',
      codeVerifier: 'verifier',
    });
    const otherKey = createExternalAuthSecurity('x'.repeat(32));
    expect(() => otherKey.unseal(invalidShape)).toThrow();
  });

  it.each([null, {}, { nonce: 'nonce' }, { codeVerifier: 'verifier' }])(
    'rejects decrypted envelopes with an invalid secret shape',
    (payload) => {
      const secret = 'k'.repeat(32);
      const initializationVector = randomBytes(12);
      const cipher = createCipheriv(
        'aes-256-gcm',
        createHash('sha256').update(secret).digest(),
        initializationVector,
      );
      const ciphertext = Buffer.concat([
        cipher.update(JSON.stringify(payload), 'utf8'),
        cipher.final(),
      ]);
      const sealed = [
        initializationVector.toString('base64url'),
        cipher.getAuthTag().toString('base64url'),
        ciphertext.toString('base64url'),
      ].join('.');
      expect(() => createExternalAuthSecurity(secret).unseal(sealed)).toThrow(
        'Invalid external authorization transaction',
      );
    },
  );
});
