import { describe, expect, it } from 'vitest';
import { createOnboardingSecurity } from './security.js';

describe('onboarding security [REQ-006, REQ-007, REQ-024]', () => {
  const security = createOnboardingSecurity({
    passwordPepper: 'test-password-pepper-with-sufficient-entropy',
    verificationDigestKey: 'test-verification-key-with-sufficient-entropy',
  });

  it('hashes passwords with the approved Argon2id baseline and pepper', async () => {
    const hash = await security.hashPassword('Correct horse battery staple!7');

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    expect(hash).not.toContain('Correct horse battery staple!7');
    expect(hash).not.toContain('test-password-pepper');
  });

  it('creates six-digit codes and stable keyed digests', () => {
    const code = security.createVerificationCode();

    expect(code).toMatch(/^\d{6}$/);
    expect(security.digestVerificationCode('123456')).toBe(
      security.digestVerificationCode('123456'),
    );
    expect(security.digestVerificationCode('123456')).not.toBe(
      security.digestVerificationCode('654321'),
    );
    expect(security.digestVerificationCode('123456')).not.toContain('123456');
  });
});
