import type {
  CreateOnboardingAccountRequest,
  CreateOnboardingAccountResponse,
} from '@hansel/contracts';

export interface PendingAccount {
  email: string;
  passwordHash: string;
  verificationCodeDigest: string;
  verificationExpiresAt: Date;
  termsVersion: string;
  privacyVersion: string;
  consentedAt: Date;
}

interface AccountRegistrationDependencies {
  hashPassword(password: string): Promise<string>;
  createVerificationCode(): string;
  digestVerificationCode(code: string): string;
  storePendingAccount(input: PendingAccount): Promise<{ shouldSend: boolean }>;
  sendVerificationCode(email: string, code: string): Promise<void>;
  now(): Date;
}

export function createAccountRegistration(
  dependencies: AccountRegistrationDependencies,
) {
  return async function register(
    input: CreateOnboardingAccountRequest,
  ): Promise<CreateOnboardingAccountResponse> {
    const now = dependencies.now();
    const code = dependencies.createVerificationCode();
    const passwordHash = await dependencies.hashPassword(input.password);

    const stored = await dependencies.storePendingAccount({
      email: input.email,
      passwordHash,
      verificationCodeDigest: dependencies.digestVerificationCode(code),
      verificationExpiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      termsVersion: input.termsVersion,
      privacyVersion: input.privacyVersion,
      consentedAt: now,
    });
    if (stored.shouldSend) {
      await dependencies.sendVerificationCode(input.email, code);
    }

    return { nextStep: 'verify-email' };
  };
}
