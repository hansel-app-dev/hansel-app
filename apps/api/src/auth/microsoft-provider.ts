/** @spec microsoft-local-auth REQ-002, REQ-003, REQ-005 */
import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  customFetch,
  discovery,
  enableNonRepudiationChecks,
  type CustomFetch,
} from 'openid-client';
import { z } from 'zod';

const origin = 'https://login.microsoftonline.com';
const identityClaims = z.object({
  tid: z.uuid(),
  iss: z.string(),
  sub: z.string().min(1).max(255),
  email: z.unknown().optional(),
});

/** Microsoft claims suggest a contact address; they never verify a mailbox. */
export function createMicrosoftProviderAdapter(
  config: { clientId: string; clientSecret: string },
  fetcher?: CustomFetch,
) {
  let configuration: ReturnType<typeof discovery> | undefined;
  const getConfiguration = () =>
    (configuration ??= discovery(
      new URL(`${origin}/common/v2.0`),
      config.clientId,
      {
        client_secret: config.clientSecret,
        id_token_signed_response_alg: 'RS256',
      },
      undefined,
      {
        ...(fetcher ? { [customFetch]: fetcher } : {}),
        execute: [enableNonRepudiationChecks],
        timeout: 10,
      },
    ));
  return {
    async buildAuthorizationUrl(input: {
      state: string;
      nonce: string;
      codeVerifier: string;
      redirectUri: string;
    }) {
      return buildAuthorizationUrl(await getConfiguration(), {
        response_type: 'code',
        scope: 'openid profile email',
        redirect_uri: input.redirectUri,
        state: input.state,
        nonce: input.nonce,
        code_challenge: await calculatePKCECodeChallenge(input.codeVerifier),
        code_challenge_method: 'S256',
      }).href;
    },
    async exchange(input: {
      callbackUrl: URL;
      redirectUri: string;
      state: string;
      nonce: string;
      codeVerifier: string;
    }) {
      if (
        input.callbackUrl.origin + input.callbackUrl.pathname !==
        input.redirectUri
      )
        throw new Error('Provider callback is invalid');
      const result = await authorizationCodeGrant(
        await getConfiguration(),
        input.callbackUrl,
        {
          expectedState: input.state,
          expectedNonce: input.nonce,
          pkceCodeVerifier: input.codeVerifier,
          idTokenExpected: true,
        },
      );
      // The library validates Microsoft's tenant-specific issuer against tid.
      // Check application constraints without following a claim-supplied URL.
      const claims = identityClaims.parse(result.claims());
      const subject = z
        .string()
        .max(512)
        .parse(JSON.stringify([claims.iss, claims.sub]));
      const email = z.email().max(254).safeParse(claims.email);
      return {
        subject,
        ...(email.success ? { emailHint: email.data.toLowerCase() } : {}),
      };
    },
  };
}
