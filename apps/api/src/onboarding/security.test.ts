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
    await expect(
      security.verifyPassword(hash, 'Correct horse battery staple!7'),
    ).resolves.toBe(true);
    await expect(
      security.verifyPassword(hash, 'Incorrect password!7'),
    ).resolves.toBe(false);
  });

  it('creates six-digit codes and stable keyed digests [password-recovery REQ-005, REQ-007]', () => {
    const code = security.createVerificationCode();

    expect(code).toMatch(/^\d{6}$/);
    expect(security.digestVerificationCode('123456')).toBe(
      security.digestVerificationCode('123456'),
    );
    expect(security.digestVerificationCode('123456')).not.toBe(
      security.digestVerificationCode('654321'),
    );
    expect(security.digestVerificationCode('123456')).not.toContain('123456');
    expect(security.digestPasswordRecoveryIdentifier('owner@example.com')).toBe(
      security.digestPasswordRecoveryIdentifier('owner@example.com'),
    );
    expect(
      security.digestPasswordRecoveryIdentifier('owner@example.com'),
    ).not.toContain('owner@example.com');
    expect(
      security.digestPasswordRecoveryIdentifier('owner@example.com'),
    ).not.toBe(security.digestVerificationCode('owner@example.com'));
  });

  it('creates opaque onboarding credentials and domain-separated digests [REQ-086]', () => {
    const credential = security.createOnboardingCredential();

    expect(credential).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(security.digestOnboardingCredential(credential)).toBe(
      security.digestOnboardingCredential(credential),
    );
    expect(security.digestOnboardingCredential(credential)).not.toContain(
      credential,
    );
    expect(security.digestOnboardingCredential('123456')).not.toBe(
      security.digestVerificationCode('123456'),
    );
    expect(
      security.deriveOnboardingCredential(credential, 'submission-key'),
    ).toBe(security.deriveOnboardingCredential(credential, 'submission-key'));
    expect(
      security.deriveOnboardingCredential(credential, 'submission-key'),
    ).not.toBe(
      security.deriveOnboardingCredential(credential, 'different-key'),
    );
  });

  it('creates session-bound CSRF proof [REQ-029, REQ-086]', () => {
    const proof = security.createOnboardingCsrfProof('credential-one');
    expect(proof).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(security.verifyOnboardingCsrfProof('credential-one', proof)).toBe(
      true,
    );
    expect(security.verifyOnboardingCsrfProof('credential-two', proof)).toBe(
      false,
    );
    expect(
      security.verifyOnboardingCsrfProof('credential-one', 'malformed'),
    ).toBe(false);
  });

  it('creates opaque domain-separated application credentials [dashboard-home REQ-009]', () => {
    const credential = security.createApplicationCredential();
    const independentlyKeyed = createOnboardingSecurity({
      passwordPepper: 'test-password-pepper-with-sufficient-entropy',
      verificationDigestKey: 'test-verification-key-with-sufficient-entropy',
      applicationSessionDigestKey:
        'test-application-session-key-with-sufficient-entropy',
    });

    expect(credential).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(security.digestApplicationCredential(credential)).toBe(
      security.digestApplicationCredential(credential),
    );
    expect(security.digestApplicationCredential(credential)).not.toContain(
      credential,
    );
    expect(security.digestApplicationCredential('same')).not.toBe(
      security.digestOnboardingCredential('same'),
    );
    expect(independentlyKeyed.digestApplicationCredential('same')).not.toBe(
      security.digestApplicationCredential('same'),
    );
  });

  it('creates deterministic opaque site-invitation tokens and domain-separated digests [sites-add-new REQ-015]', () => {
    const expiresAt = new Date('2026-09-08T00:00:00.000Z');
    const first = security.createSiteInvitationToken(
      '7fced42f-e2e4-4c31-89db-f282bdaeea44',
      expiresAt,
    );
    const second = security.createSiteInvitationToken(
      '7fced42f-e2e4-4c31-89db-f282bdaeea44',
      expiresAt,
    );

    expect(first).toEqual(second);
    expect(first.token).not.toContain('7fced42f');
    expect(first.tokenDigest).toHaveLength(64);
    expect(first.tokenDigest).not.toBe(
      security.digestApplicationCredential(first.token),
    );
  });
});
