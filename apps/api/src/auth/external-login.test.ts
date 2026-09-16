import { describe, expect, it, vi } from 'vitest';
import { createExternalLogin } from './external-login.js';

function dependencies() {
  return {
    providers: {
      google: {
        buildAuthorizationUrl: vi
          .fn()
          .mockResolvedValue('https://accounts.example/authorize'),
        exchange: vi.fn().mockResolvedValue({ subject: 'provider-subject' }),
      },
      microsoft: {
        buildAuthorizationUrl: vi.fn(),
        exchange: vi.fn(),
      },
      apple: {
        buildAuthorizationUrl: vi.fn(),
        exchange: vi.fn(),
      },
    },
    createTransaction: vi.fn(),
    consumeTransaction: vi.fn().mockResolvedValue({
      intent: 'login' as const,
      redirectUri: 'https://app.example/auth/callback/google',
      nonceDigest: 'digest:nonce',
      pkceVerifierDigest: 'digest:verifier',
      sealedSecrets: 'sealed',
    }),
    completeIdentityLogin: vi.fn().mockResolvedValue({
      destination: '/dashboard' as const,
      sessionKind: 'application' as const,
    }),
    createState: () => 'state',
    createNonce: () => 'nonce',
    createCodeVerifier: () => 'verifier',
    callbackUri: (provider: string) =>
      `https://app.example/auth/callback/${provider}`,
    digest: (value: string) => `digest:${value}`,
    seal: () => 'sealed',
    unseal: () => ({ nonce: 'nonce', codeVerifier: 'verifier' }),
    createApplicationCredential: vi
      .fn()
      .mockReturnValueOnce('access')
      .mockReturnValueOnce('refresh'),
    digestApplicationCredential: (value: string) => `digest:${value}`,
    createOnboardingCredential: () => 'onboarding',
    digestOnboardingCredential: (value: string) => `digest:${value}`,
    createOnboardingCsrfProof: (value: string) => `csrf:${value}`,
    now: () => new Date('2026-08-30T00:00:00.000Z'),
    recordEvent: vi.fn(),
  };
}

describe('external login [user-login REQ-013..REQ-015]', () => {
  it('preserves a new Microsoft identity in pending signup, never granting a session [microsoft-local-auth REQ-004]', async () => {
    const deps = dependencies();
    deps.consumeTransaction.mockResolvedValue({
      intent: 'onboarding',
      termsVersion: '2026-08-27',
      privacyVersion: '2026-08-27',
      redirectUri: 'https://app.example/auth/callback/microsoft',
      nonceDigest: 'digest:nonce',
      pkceVerifierDigest: 'digest:verifier',
      sealedSecrets: 'sealed',
    });
    deps.providers.microsoft.exchange.mockResolvedValue({
      subject: 'immutable',
      emailHint: 'suggestion@example.com',
      verifiedEmail: 'must-not-trust@example.com',
    });
    deps.completeIdentityLogin.mockResolvedValue('email-signup-required');
    const startMicrosoftSignup = vi.fn().mockResolvedValue('pending');
    const result = await createExternalLogin({
      ...deps,
      startMicrosoftSignup,
    }).callback(
      'microsoft',
      new URL(
        'https://app.example/auth/callback/microsoft?state=state&code=code',
      ),
    );
    expect(result).toEqual({
      status: 'microsoft-email-required',
      pendingCredential: 'pending',
    });
    expect(deps.completeIdentityLogin.mock.calls[0]?.[0]).not.toHaveProperty(
      'verifiedEmail',
    );
  });
  it('fails closed for disabled providers [google-local-auth REQ-001]', async () => {
    const deps = dependencies();
    const flow = createExternalLogin({ ...deps, providers: {} });
    await expect(flow.start('google', 'login')).rejects.toThrow(
      'Provider unavailable',
    );
    await expect(
      flow.callback(
        'google',
        new URL('https://app.example/auth/callback/google?state=state'),
      ),
    ).resolves.toEqual({ status: 'rejected' });
    expect(deps.createTransaction).not.toHaveBeenCalled();
  });
  it('requires current privacy consent and preserves the email signup fallback [google-local-auth REQ-003, REQ-004]', async () => {
    const deps = dependencies();
    const transaction = {
      intent: 'onboarding',
      termsVersion: '2026-08-27',
      privacyVersion: 'old',
      redirectUri: 'https://app.example/auth/callback/google',
      nonceDigest: 'digest:nonce',
      pkceVerifierDigest: 'digest:verifier',
      sealedSecrets: 'sealed',
    };
    const callback = new URL(
      'https://app.example/auth/callback/google?state=state&code=code',
    );
    deps.consumeTransaction.mockResolvedValueOnce(transaction);
    await expect(
      createExternalLogin(deps).callback('google', callback),
    ).resolves.toEqual({ status: 'rejected' });
    deps.consumeTransaction.mockResolvedValueOnce({
      ...transaction,
      privacyVersion: '2026-08-27',
    });
    deps.completeIdentityLogin.mockResolvedValueOnce('email-signup-required');
    await expect(
      createExternalLogin(deps).callback('google', callback),
    ).resolves.toEqual({ status: 'email-signup-required' });
  });
  it('records policy consent for onboarding [google-local-auth REQ-003]', async () => {
    const deps = dependencies();
    await createExternalLogin(deps).start('google', 'onboarding');
    expect(deps.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        termsVersion: '2026-08-27',
        privacyVersion: '2026-08-27',
      }),
    );
  });

  it('passes validated onboarding identity and consent to atomic completion [google-local-auth REQ-003]', async () => {
    const deps = dependencies();
    deps.consumeTransaction.mockResolvedValueOnce({
      intent: 'onboarding',
      termsVersion: '2026-08-27',
      privacyVersion: '2026-08-27',
      redirectUri: 'https://app.example/auth/callback/google',
      nonceDigest: 'digest:nonce',
      pkceVerifierDigest: 'digest:verifier',
      sealedSecrets: 'sealed',
    });
    deps.providers.google.exchange.mockResolvedValueOnce({
      subject: 'new-subject',
      verifiedEmail: 'new@example.com',
    });
    await createExternalLogin(deps).callback(
      'google',
      new URL('https://app.example/auth/callback/google?code=code&state=state'),
    );
    expect(deps.completeIdentityLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: 'onboarding',
        subject: 'new-subject',
        verifiedEmail: 'new@example.com',
        termsVersion: '2026-08-27',
        privacyVersion: '2026-08-27',
      }),
    );
  });
  it('starts a short-lived login transaction and returns only the provider URL', async () => {
    const deps = dependencies();
    const externalLogin = createExternalLogin(deps);

    await expect(externalLogin.start('google', 'login')).resolves.toBe(
      'https://accounts.example/authorize',
    );
    expect(deps.createTransaction).toHaveBeenCalledWith({
      provider: 'google',
      intent: 'login',
      stateDigest: 'digest:state',
      nonceDigest: 'digest:nonce',
      pkceVerifierDigest: 'digest:verifier',
      sealedSecrets: 'sealed',
      redirectUri: 'https://app.example/auth/callback/google',
      expiresAt: new Date('2026-08-30T00:10:00.000Z'),
    });
    expect(deps.providers.google.buildAuthorizationUrl).toHaveBeenCalledWith({
      state: 'state',
      nonce: 'nonce',
      codeVerifier: 'verifier',
      redirectUri: 'https://app.example/auth/callback/google',
    });
  });

  it('consumes a callback once and issues only Hansel credentials for a bound identity', async () => {
    const deps = dependencies();
    const externalLogin = createExternalLogin(deps);

    await expect(
      externalLogin.callback(
        'google',
        new URL(
          'https://app.example/auth/callback/google?code=code&state=state',
        ),
      ),
    ).resolves.toEqual({
      status: 'accepted',
      destination: '/dashboard',
      applicationSession: {
        accessCredential: 'access',
        refreshCredential: 'refresh',
      },
    });
    expect(deps.consumeTransaction).toHaveBeenCalledWith({
      provider: 'google',
      stateDigest: 'digest:state',
      now: new Date('2026-08-30T00:00:00.000Z'),
    });
    expect(deps.providers.google.exchange).toHaveBeenCalledWith({
      callbackUrl: new URL(
        'https://app.example/auth/callback/google?code=code&state=state',
      ),
      redirectUri: 'https://app.example/auth/callback/google',
      state: 'state',
      nonce: 'nonce',
      codeVerifier: 'verifier',
    });
    expect(deps.completeIdentityLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        subject: 'provider-subject',
      }),
    );
  });

  it.each([
    ['provider error', '?error=access_denied&state=state'],
    ['missing state', '?code=code'],
  ])('rejects a %s before transaction access', async (_name, query) => {
    const deps = dependencies();
    const externalLogin = createExternalLogin(deps);
    await expect(
      externalLogin.callback(
        'google',
        new URL(`https://app.example/auth/callback/google${query}`),
      ),
    ).resolves.toEqual({ status: 'rejected' });
    expect(deps.consumeTransaction).not.toHaveBeenCalled();
  });

  it('rejects an expired, replayed, or unbound provider identity generically', async () => {
    const deps = dependencies();
    deps.consumeTransaction.mockResolvedValueOnce(null);
    const externalLogin = createExternalLogin(deps);
    const callback = new URL(
      'https://app.example/auth/callback/google?code=code&state=state',
    );
    await expect(externalLogin.callback('google', callback)).resolves.toEqual({
      status: 'rejected',
    });

    deps.consumeTransaction.mockResolvedValueOnce({
      intent: 'login',
      redirectUri: 'https://app.example/auth/callback/google',
      nonceDigest: 'digest:nonce',
      pkceVerifierDigest: 'digest:verifier',
      sealedSecrets: 'sealed',
    });
    deps.completeIdentityLogin.mockResolvedValueOnce(null);
    await expect(externalLogin.callback('google', callback)).resolves.toEqual({
      status: 'rejected',
    });
  });

  it('rejects the wrong transaction intent or modified sealed secrets', async () => {
    const wrongIntent = dependencies();
    wrongIntent.consumeTransaction.mockResolvedValueOnce({
      intent: 'onboarding',
      redirectUri: 'https://app.example/auth/callback/google',
      nonceDigest: 'digest:nonce',
      pkceVerifierDigest: 'digest:verifier',
      sealedSecrets: 'sealed',
    });
    const callback = new URL(
      'https://app.example/auth/callback/google?code=code&state=state',
    );
    await expect(
      createExternalLogin(wrongIntent).callback('google', callback),
    ).resolves.toEqual({ status: 'rejected' });

    const modified = dependencies();
    modified.unseal = () => ({ nonce: 'modified', codeVerifier: 'verifier' });
    await expect(
      createExternalLogin(modified).callback('google', callback),
    ).resolves.toEqual({ status: 'rejected' });
    expect(modified.providers.google.exchange).not.toHaveBeenCalled();
  });

  it('resumes onboarding with a Hansel continuation and CSRF proof', async () => {
    const deps = dependencies();
    deps.completeIdentityLogin.mockResolvedValueOnce({
      destination: '/onboarding/about-you',
      sessionKind: 'onboarding',
    });
    await expect(
      createExternalLogin(deps).callback(
        'google',
        new URL(
          'https://app.example/auth/callback/google?code=code&state=state',
        ),
      ),
    ).resolves.toEqual({
      status: 'accepted',
      destination: '/onboarding/about-you',
      onboardingSession: {
        onboardingCredential: 'onboarding',
        csrfProof: 'csrf:onboarding',
      },
    });
  });
});
