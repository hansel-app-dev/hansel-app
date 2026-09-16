import { describe, expect, it, vi } from 'vitest';
import { createOpenIdProviderAdapter } from './openid-provider.js';

describe('OpenID provider adapter [user-login REQ-013..REQ-015]', () => {
  it.each([true, false, 'true', undefined])(
    'only accepts boolean verified usable email (%s) [google-local-auth REQ-004]',
    async (verified) => {
      const adapter = createOpenIdProviderAdapter(
        {
          issuer: 'https://accounts.google.com',
          clientId: 'id',
          clientSecret: 'secret',
          scope: 'openid email profile',
          usePkce: true,
        },
        {
          discover: vi.fn().mockResolvedValue({}),
          calculateChallenge: vi.fn(),
          buildUrl: vi.fn(),
          exchangeCode: vi
            .fn()
            .mockResolvedValue({
              claims: () => ({
                sub: 'subject',
                email: 'user@example.com',
                email_verified: verified,
              }),
            }),
        },
      );
      const result = await adapter.exchange({
        callbackUrl: new URL('http://localhost:5173/auth/callback/google'),
        redirectUri: 'http://localhost:5173/auth/callback/google',
        state: 'state',
        nonce: 'nonce',
        codeVerifier: 'verifier',
      });
      expect(result).toEqual({
        subject: 'subject',
        ...(verified === true ? { verifiedEmail: 'user@example.com' } : {}),
      });
    },
  );
  it('builds a state, nonce, exact-callback, and S256 PKCE authorization request', async () => {
    const configuration = {} as never;
    const dependencies = {
      discover: vi.fn().mockResolvedValue(configuration),
      calculateChallenge: vi.fn().mockResolvedValue('challenge'),
      buildUrl: vi
        .fn()
        .mockReturnValue(new URL('https://provider.example/authorize')),
      exchangeCode: vi.fn(),
    };
    const adapter = createOpenIdProviderAdapter(
      {
        issuer: 'https://provider.example',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        scope: 'openid email profile',
        usePkce: true,
      },
      dependencies,
    );

    await expect(
      adapter.buildAuthorizationUrl({
        state: 'state',
        nonce: 'nonce',
        codeVerifier: 'verifier',
        redirectUri: 'https://app.example/auth/callback/google',
      }),
    ).resolves.toBe('https://provider.example/authorize');
    expect(dependencies.discover).toHaveBeenCalledWith(
      new URL('https://provider.example'),
      'client-id',
      'client-secret',
    );
    expect(dependencies.buildUrl).toHaveBeenCalledWith(configuration, {
      client_id: 'client-id',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
      nonce: 'nonce',
      redirect_uri: 'https://app.example/auth/callback/google',
      response_type: 'code',
      scope: 'openid email profile',
      state: 'state',
    });
  });

  it('validates the grant and exposes only the immutable provider subject', async () => {
    const configuration = {} as never;
    const dependencies = {
      discover: vi.fn().mockResolvedValue(configuration),
      calculateChallenge: vi.fn(),
      buildUrl: vi.fn(),
      exchangeCode: vi.fn().mockResolvedValue({
        access_token: 'must-not-escape',
        id_token: 'must-not-escape',
        claims: () => ({
          sub: 'immutable-subject',
          email: 'private@example.com',
        }),
      }),
    };
    const adapter = createOpenIdProviderAdapter(
      {
        issuer: 'https://provider.example',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        scope: 'openid email profile',
        usePkce: true,
      },
      dependencies,
    );
    const callbackUrl = new URL(
      'https://app.example/auth/callback/google?code=code&state=state',
    );

    await expect(
      adapter.exchange({
        callbackUrl,
        redirectUri: 'https://app.example/auth/callback/google',
        state: 'state',
        nonce: 'nonce',
        codeVerifier: 'verifier',
      }),
    ).resolves.toEqual({ subject: 'immutable-subject' });
    expect(dependencies.exchangeCode).toHaveBeenCalledWith(
      configuration,
      callbackUrl,
      {
        expectedNonce: 'nonce',
        expectedState: 'state',
        idTokenExpected: true,
        pkceCodeVerifier: 'verifier',
      },
    );
  });

  it('uses form_post without PKCE for Apple and rejects a missing subject', async () => {
    const configuration = {} as never;
    const dependencies = {
      discover: vi.fn().mockResolvedValue(configuration),
      calculateChallenge: vi.fn(),
      buildUrl: vi.fn().mockReturnValue(new URL('https://apple.example')),
      exchangeCode: vi.fn().mockResolvedValue({ claims: () => ({}) }),
    };
    const adapter = createOpenIdProviderAdapter(
      {
        issuer: 'https://appleid.apple.com',
        clientId: 'apple-client',
        clientSecret: 'apple-secret',
        scope: 'name email',
        usePkce: false,
        responseMode: 'form_post',
      },
      dependencies,
    );
    await adapter.buildAuthorizationUrl({
      state: 'state',
      nonce: 'nonce',
      codeVerifier: 'unused-verifier',
      redirectUri: 'https://dev.example/auth/callback/apple',
    });
    expect(dependencies.calculateChallenge).not.toHaveBeenCalled();
    expect(dependencies.buildUrl).toHaveBeenCalledWith(
      configuration,
      expect.objectContaining({ response_mode: 'form_post' }),
    );
    await expect(
      adapter.exchange({
        callbackUrl: new URL(
          'https://dev.example/auth/callback/apple?code=code&state=state',
        ),
        redirectUri: 'https://dev.example/auth/callback/apple',
        state: 'state',
        nonce: 'nonce',
        codeVerifier: 'unused-verifier',
      }),
    ).rejects.toThrow('Provider identity is unavailable');
  });

  it('rejects a callback delivered to any URL other than the registered callback', async () => {
    const adapter = createOpenIdProviderAdapter(
      {
        issuer: 'https://provider.example',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        scope: 'openid email',
        usePkce: true,
      },
      {
        discover: vi.fn(),
        calculateChallenge: vi.fn(),
        buildUrl: vi.fn(),
        exchangeCode: vi.fn(),
      },
    );
    await expect(
      adapter.exchange({
        callbackUrl: new URL('https://evil.example/auth/callback/google'),
        redirectUri: 'https://app.example/auth/callback/google',
        state: 'state',
        nonce: 'nonce',
        codeVerifier: 'verifier',
      }),
    ).rejects.toThrow('Provider callback is invalid');
  });
});
