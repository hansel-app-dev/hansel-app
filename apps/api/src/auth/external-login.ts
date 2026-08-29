/** @spec user-login REQ-013..REQ-018 */
import type { LoginDestination } from '@hansel/contracts';

export const externalProviders = ['google', 'microsoft', 'apple'] as const;
export type ExternalProvider = (typeof externalProviders)[number];
export type ExternalIntent = 'login' | 'onboarding';

interface ProviderAdapter {
  buildAuthorizationUrl(input: {
    state: string;
    nonce: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<string>;
  exchange(input: {
    callbackUrl: URL;
    redirectUri: string;
    state: string;
    nonce: string;
    codeVerifier: string;
  }): Promise<{ subject: string }>;
}

interface ExternalTransaction {
  intent: ExternalIntent;
  redirectUri: string;
  nonceDigest: string;
  pkceVerifierDigest: string | null;
  sealedSecrets: string;
}

interface Completion {
  destination: LoginDestination;
  sessionKind: 'application' | 'onboarding';
}

interface ExternalLoginDependencies {
  providers: Record<ExternalProvider, ProviderAdapter>;
  callbackUri(provider: ExternalProvider): string;
  createTransaction(input: {
    provider: ExternalProvider;
    intent: ExternalIntent;
    stateDigest: string;
    nonceDigest: string;
    pkceVerifierDigest: string;
    sealedSecrets: string;
    redirectUri: string;
    expiresAt: Date;
  }): Promise<void>;
  consumeTransaction(input: {
    provider: ExternalProvider;
    stateDigest: string;
    now: Date;
  }): Promise<ExternalTransaction | null>;
  completeIdentityLogin(input: {
    provider: ExternalProvider;
    subject: string;
    now: Date;
    accessCredentialDigest: string;
    accessExpiresAt: Date;
    refreshCredentialDigest: string;
    absoluteExpiresAt: Date;
    onboardingCredentialDigest: string;
    onboardingExpiresAt: Date;
  }): Promise<Completion | null>;
  createState(): string;
  createNonce(): string;
  createCodeVerifier(): string;
  digest(value: string): string;
  seal(value: { nonce: string; codeVerifier: string }): string;
  unseal(value: string): { nonce: string; codeVerifier: string };
  createApplicationCredential(): string;
  digestApplicationCredential(value: string): string;
  createOnboardingCredential(): string;
  digestOnboardingCredential(value: string): string;
  createOnboardingCsrfProof(value: string): string;
  now(): Date;
  recordEvent(name: string): void;
}

export type ExternalLoginResult =
  | { status: 'rejected' }
  | {
      status: 'accepted';
      destination: LoginDestination;
      applicationSession?: {
        accessCredential: string;
        refreshCredential: string;
      };
      onboardingSession?: {
        onboardingCredential: string;
        csrfProof: string;
      };
    };

export function createExternalLogin(dependencies: ExternalLoginDependencies) {
  return {
    async start(
      provider: ExternalProvider,
      intent: ExternalIntent,
    ): Promise<string> {
      const state = dependencies.createState();
      const nonce = dependencies.createNonce();
      const codeVerifier = dependencies.createCodeVerifier();
      const redirectUri = dependencies.callbackUri(provider);
      const now = dependencies.now();
      await dependencies.createTransaction({
        provider,
        intent,
        stateDigest: dependencies.digest(state),
        nonceDigest: dependencies.digest(nonce),
        pkceVerifierDigest: dependencies.digest(codeVerifier),
        sealedSecrets: dependencies.seal({ nonce, codeVerifier }),
        redirectUri,
        expiresAt: new Date(now.getTime() + 10 * 60 * 1_000),
      });
      const destination = await dependencies.providers[
        provider
      ].buildAuthorizationUrl({ state, nonce, codeVerifier, redirectUri });
      dependencies.recordEvent('external_login_started');
      return destination;
    },

    async callback(
      provider: ExternalProvider,
      callbackUrl: URL,
    ): Promise<ExternalLoginResult> {
      const state = callbackUrl.searchParams.get('state');
      if (!state || callbackUrl.searchParams.has('error')) {
        dependencies.recordEvent('external_login_rejected');
        return { status: 'rejected' };
      }
      const now = dependencies.now();
      const transaction = await dependencies.consumeTransaction({
        provider,
        stateDigest: dependencies.digest(state),
        now,
      });
      if (transaction?.intent !== 'login') {
        dependencies.recordEvent('external_login_rejected');
        return { status: 'rejected' };
      }
      const { nonce, codeVerifier } = dependencies.unseal(
        transaction.sealedSecrets,
      );
      if (
        dependencies.digest(nonce) !== transaction.nonceDigest ||
        dependencies.digest(codeVerifier) !== transaction.pkceVerifierDigest
      ) {
        dependencies.recordEvent('external_login_rejected');
        return { status: 'rejected' };
      }
      const identity = await dependencies.providers[provider].exchange({
        callbackUrl,
        redirectUri: transaction.redirectUri,
        state,
        nonce,
        codeVerifier,
      });
      const accessCredential = dependencies.createApplicationCredential();
      const refreshCredential = dependencies.createApplicationCredential();
      const onboardingCredential = dependencies.createOnboardingCredential();
      const completion = await dependencies.completeIdentityLogin({
        provider,
        subject: identity.subject,
        now,
        accessCredentialDigest:
          dependencies.digestApplicationCredential(accessCredential),
        accessExpiresAt: new Date(now.getTime() + 15 * 60 * 1_000),
        refreshCredentialDigest:
          dependencies.digestApplicationCredential(refreshCredential),
        absoluteExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000),
        onboardingCredentialDigest:
          dependencies.digestOnboardingCredential(onboardingCredential),
        onboardingExpiresAt: new Date(now.getTime() + 15 * 60 * 1_000),
      });
      if (!completion) {
        dependencies.recordEvent('external_login_rejected');
        return { status: 'rejected' };
      }
      dependencies.recordEvent('external_login_succeeded');
      if (completion.sessionKind === 'onboarding')
        return {
          status: 'accepted',
          destination: completion.destination,
          onboardingSession: {
            onboardingCredential,
            csrfProof:
              dependencies.createOnboardingCsrfProof(onboardingCredential),
          },
        };
      return {
        status: 'accepted',
        destination: completion.destination,
        applicationSession: { accessCredential, refreshCredential },
      };
    },
  };
}
