/** @spec user-login REQ-013..REQ-015 */
import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  discovery,
  type Configuration,
  type AuthorizationCodeGrantChecks,
} from 'openid-client';

export interface OpenIdProviderConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  usePkce: boolean;
  responseMode?: 'form_post';
}

interface GrantResult {
  claims():
    { sub?: unknown; email?: unknown; email_verified?: unknown } | undefined;
}

interface OpenIdDependencies {
  discover(
    issuer: URL,
    clientId: string,
    clientSecret: string,
  ): Promise<Configuration>;
  calculateChallenge(codeVerifier: string): Promise<string>;
  buildUrl(
    configuration: Configuration,
    parameters: Record<string, string>,
  ): URL;
  exchangeCode(
    configuration: Configuration,
    currentUrl: URL,
    checks: AuthorizationCodeGrantChecks,
  ): Promise<GrantResult>;
}

const defaultDependencies: OpenIdDependencies = {
  discover: discovery,
  calculateChallenge: calculatePKCECodeChallenge,
  buildUrl: buildAuthorizationUrl,
  exchangeCode: authorizationCodeGrant,
};

export function createOpenIdProviderAdapter(
  config: OpenIdProviderConfig,
  dependencies: OpenIdDependencies = defaultDependencies,
) {
  let configuration: Promise<Configuration> | undefined;
  const getConfiguration = () =>
    (configuration ??= dependencies.discover(
      new URL(config.issuer),
      config.clientId,
      config.clientSecret,
    ));

  return {
    async buildAuthorizationUrl(input: {
      state: string;
      nonce: string;
      codeVerifier: string;
      redirectUri: string;
    }): Promise<string> {
      const parameters: Record<string, string> = {
        client_id: config.clientId,
        nonce: input.nonce,
        redirect_uri: input.redirectUri,
        response_type: 'code',
        scope: config.scope,
        state: input.state,
      };
      if (config.responseMode) parameters.response_mode = config.responseMode;
      if (config.usePkce) {
        parameters.code_challenge = await dependencies.calculateChallenge(
          input.codeVerifier,
        );
        parameters.code_challenge_method = 'S256';
      }
      return dependencies.buildUrl(await getConfiguration(), parameters).href;
    },

    async exchange(input: {
      callbackUrl: URL;
      redirectUri: string;
      state: string;
      nonce: string;
      codeVerifier: string;
    }): Promise<{ subject: string; verifiedEmail?: string }> {
      if (
        input.callbackUrl.origin + input.callbackUrl.pathname !==
        input.redirectUri
      )
        throw new Error('Provider callback is invalid');
      const checks: AuthorizationCodeGrantChecks = {
        expectedNonce: input.nonce,
        expectedState: input.state,
        idTokenExpected: true,
      };
      if (config.usePkce) checks.pkceCodeVerifier = input.codeVerifier;
      const result = await dependencies.exchangeCode(
        await getConfiguration(),
        input.callbackUrl,
        checks,
      );
      const claims = result.claims();
      const subject = claims?.sub;
      if (typeof subject !== 'string' || !subject)
        throw new Error('Provider identity is unavailable');
      const email = claims.email;
      return {
        subject,
        ...(claims.email_verified === true &&
        typeof email === 'string' &&
        email.length <= 254 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          ? { verifiedEmail: email.toLowerCase() }
          : {}),
      };
    },
  };
}
