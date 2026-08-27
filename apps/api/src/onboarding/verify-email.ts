import type {
  ResendOnboardingVerificationRequest,
  ResendOnboardingVerificationResponse,
  VerifyOnboardingEmailRequest,
  VerifyOnboardingEmailResponse,
} from '@hansel/contracts';

export class VerificationFailedError extends Error {
  readonly code = 'verification_failed';
}

interface VerificationDependencies {
  verify(input: {
    email: string;
    codeDigest: string;
    onboardingCredentialDigest: string;
    onboardingCredentialExpiresAt: Date;
    now: Date;
  }): Promise<boolean>;
  resend(input: {
    email: string;
    codeDigest: string;
    expiresAt: Date;
    now: Date;
  }): Promise<boolean>;
  digestVerificationCode(code: string): string;
  createVerificationCode(): string;
  createOnboardingCredential(): string;
  digestOnboardingCredential(credential: string): string;
  createOnboardingCsrfProof(credential: string): string;
  sendVerificationCode(email: string, code: string): Promise<void>;
  now(): Date;
}

export function createEmailVerification(
  dependencies: VerificationDependencies,
) {
  return {
    async verifyEmail(input: VerifyOnboardingEmailRequest): Promise<
      VerifyOnboardingEmailResponse & {
        onboardingCredential: string;
        csrfProof: string;
      }
    > {
      const now = dependencies.now();
      const onboardingCredential = dependencies.createOnboardingCredential();
      const accepted = await dependencies.verify({
        email: input.email,
        codeDigest: dependencies.digestVerificationCode(input.code),
        onboardingCredentialDigest:
          dependencies.digestOnboardingCredential(onboardingCredential),
        onboardingCredentialExpiresAt: new Date(now.getTime() + 15 * 60 * 1000),
        now,
      });
      if (!accepted) throw new VerificationFailedError();
      return {
        nextStep: 'personal-profile',
        onboardingCredential,
        csrfProof: dependencies.createOnboardingCsrfProof(onboardingCredential),
      };
    },

    async resendVerification(
      input: ResendOnboardingVerificationRequest,
    ): Promise<ResendOnboardingVerificationResponse> {
      const now = dependencies.now();
      const code = dependencies.createVerificationCode();
      const shouldSend = await dependencies.resend({
        email: input.email,
        codeDigest: dependencies.digestVerificationCode(code),
        expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
        now,
      });
      if (shouldSend)
        await dependencies.sendVerificationCode(input.email, code);
      return { status: 'accepted' };
    },
  };
}
