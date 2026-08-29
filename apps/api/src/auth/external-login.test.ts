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
