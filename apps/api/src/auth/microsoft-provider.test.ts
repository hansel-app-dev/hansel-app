/** @spec microsoft-local-auth REQ-003, REQ-005 */
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterEach, expect, it, vi } from 'vitest';
import type { CustomFetch } from 'openid-client';
import { createMicrosoftProviderAdapter } from './microsoft-provider.js';

const tenant = '9188040d-6c67-4c5b-b112-36a304b66dad';
const origin = 'https://login.microsoftonline.com';
const callback = 'http://localhost:5173/auth/callback/microsoft';
afterEach(() => vi.unstubAllGlobals());

async function fixture(
  overrides: {
    tenant?: string;
    issuer?: string;
    audience?: string;
    nonce?: string;
    expires?: string;
    badSignature?: boolean;
    subject?: string;
    email?: unknown;
    defaultTransport?: boolean;
  } = {},
) {
  const selectedTenant = overrides.tenant ?? tenant;
  const keys = await generateKeyPair('RS256');
  const jwk = await exportJWK(keys.publicKey);
  const signingKey = overrides.badSignature
    ? (await generateKeyPair('RS256')).privateKey
    : keys.privateKey;
  const token = await new SignJWT({
    tid: selectedTenant,
    nonce: overrides.nonce ?? 'nonce',
    email: overrides.email ?? 'Test@example.com',
    email_verified: true,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject(overrides.subject ?? 'immutable-subject')
    .setIssuer(overrides.issuer ?? `${origin}/${selectedTenant}/v2.0`)
    .setAudience(overrides.audience ?? 'client-id')
    .setIssuedAt()
    .setExpirationTime(overrides.expires ?? '5m')
    .sign(signingKey);
  const fetcher: CustomFetch = (url) => {
    if (url.includes('.well-known'))
      return Promise.resolve(
        Response.json({
          issuer: `${origin}/{tenantid}/v2.0`,
          authorization_endpoint: `${origin}/common/oauth2/v2.0/authorize`,
          token_endpoint: `${origin}/common/oauth2/v2.0/token`,
          jwks_uri: `${origin}/common/discovery/v2.0/keys`,
          response_types_supported: ['code'],
          subject_types_supported: ['pairwise'],
          id_token_signing_alg_values_supported: ['RS256'],
        }),
      );
    if (url.endsWith('/keys'))
      return Promise.resolve(
        Response.json({
          keys: [{ ...jwk, kid: 'test-key', alg: 'RS256', use: 'sig' }],
        }),
      );
    if (url.endsWith('/token'))
      return Promise.resolve(
        Response.json({
          access_token: 'unused',
          token_type: 'Bearer',
          id_token: token,
        }),
      );
    throw new Error('Unexpected provider request');
  };
  if (overrides.defaultTransport) vi.stubGlobal('fetch', fetcher);
  const adapter = createMicrosoftProviderAdapter(
    { clientId: 'client-id', clientSecret: 'secret' },
    overrides.defaultTransport ? undefined : fetcher,
  );
  return adapter;
}

it('validates a personal Microsoft token without treating email as mailbox proof [microsoft-local-auth REQ-003]', async () => {
  const adapter = await fixture({ defaultTransport: true });
  await expect(
    adapter.exchange({
      callbackUrl: new URL(`${callback}?code=code&state=state`),
      redirectUri: callback,
      state: 'state',
      nonce: 'nonce',
      codeVerifier: 'verifier',
    }),
  ).resolves.toEqual({
    subject: JSON.stringify([`${origin}/${tenant}/v2.0`, 'immutable-subject']),
    emailHint: 'test@example.com',
  });
});

it('accepts a work/school tenant and retains its immutable issuer in the identity [microsoft-local-auth REQ-003]', async () => {
  const workTenant = '70cfb5e6-308e-403e-ba91-fff0be9b8657';
  const adapter = await fixture({ tenant: workTenant, email: 'invalid' });
  await expect(
    adapter.exchange({
      callbackUrl: new URL(`${callback}?code=code&state=state`),
      redirectUri: callback,
      state: 'state',
      nonce: 'nonce',
      codeVerifier: 'verifier',
    }),
  ).resolves.toEqual({
    subject: JSON.stringify([
      `${origin}/${workTenant}/v2.0`,
      'immutable-subject',
    ]),
  });
});

it.each([
  { issuer: 'https://attacker.example/issuer' },
  { issuer: `${origin}/70cfb5e6-308e-403e-ba91-fff0be9b8657/v2.0` },
  { tenant: '../common' },
  { audience: 'another-client' },
  { nonce: 'another-nonce' },
  { expires: '-5m' },
  { badSignature: true },
  { subject: '' },
])(
  'rejects invalid tokens without exposing an identity: %j [microsoft-local-auth REQ-003]',
  async (overrides) => {
    const adapter = await fixture(overrides);
    await expect(
      adapter.exchange({
        callbackUrl: new URL(`${callback}?code=code&state=state`),
        redirectUri: callback,
        state: 'state',
        nonce: 'nonce',
        codeVerifier: 'verifier',
      }),
    ).rejects.toThrow();
  },
);

it('rejects a mismatched state and redirect [microsoft-local-auth REQ-003]', async () => {
  const adapter = await fixture();
  const input = {
    callbackUrl: new URL(`${callback}?code=code&state=other`),
    redirectUri: callback,
    state: 'state',
    nonce: 'nonce',
    codeVerifier: 'verifier',
  };
  await expect(adapter.exchange(input)).rejects.toThrow();
  await expect(
    adapter.exchange({
      ...input,
      redirectUri: 'https://attacker.example/callback',
    }),
  ).rejects.toThrow();
});

it('requests only code flow, S256 PKCE, and the approved scopes [microsoft-local-auth REQ-003]', async () => {
  const adapter = await fixture();
  const url = new URL(
    await adapter.buildAuthorizationUrl({
      redirectUri: callback,
      state: 'state',
      nonce: 'nonce',
      codeVerifier: 'verifier',
    }),
  );
  expect(url.origin).toBe(origin);
  expect(url.searchParams.get('scope')).toBe('openid profile email');
  expect(url.searchParams.get('response_type')).toBe('code');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('code_challenge')).toBeTruthy();
  expect(url.searchParams.get('redirect_uri')).toBe(callback);
});
