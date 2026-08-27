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
  sendVerificationCode(email: string, code: string): Promise<void>;
  now(): Date;
}

export function createEmailVerification(
  dependencies: VerificationDependencies,
) {
  return {
    async verifyEmail(
      input: VerifyOnboardingEmailRequest,
    ): Promise<VerifyOnboardingEmailResponse> {
      const accepted = await dependencies.verify({
        email: input.email,
        codeDigest: dependencies.digestVerificationCode(input.code),
        now: dependencies.now(),
      });
      if (!accepted) throw new VerificationFailedError();
      return { nextStep: 'personal-profile' };
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
