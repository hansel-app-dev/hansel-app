import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { argon2id, hash } from 'argon2';

export function createOnboardingSecurity({
  passwordPepper,
  verificationDigestKey,
}: {
  passwordPepper: string;
  verificationDigestKey: string;
}) {
  return {
    async hashPassword(password: string): Promise<string> {
      return hash(password, {
        type: argon2id,
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
        secret: Buffer.from(passwordPepper),
      });
    },
    createVerificationCode(): string {
      return randomInt(0, 1_000_000).toString().padStart(6, '0');
    },
    digestVerificationCode(code: string): string {
      return createHmac('sha256', verificationDigestKey)
        .update(code)
        .digest('hex');
    },
    createOnboardingCredential(): string {
      return randomBytes(32).toString('base64url');
    },
    deriveOnboardingCredential(
      credential: string,
      submissionKey: string,
    ): string {
      return createHmac('sha256', verificationDigestKey)
        .update(`organization-profile:${credential}:${submissionKey}`)
        .digest('base64url');
    },
    digestOnboardingCredential(credential: string): string {
      return createHmac('sha256', verificationDigestKey)
        .update(`onboarding:${credential}`)
        .digest('hex');
    },
    createOnboardingCsrfProof(credential: string): string {
      return createHmac('sha256', verificationDigestKey)
        .update(`onboarding-csrf:${credential}`)
        .digest('base64url');
    },
    verifyOnboardingCsrfProof(credential: string, proof: string): boolean {
      const expected = createHmac('sha256', verificationDigestKey)
        .update(`onboarding-csrf:${credential}`)
        .digest();
      const supplied = Buffer.from(proof, 'base64url');
      return (
        supplied.length === expected.length &&
        timingSafeEqual(supplied, expected)
      );
    },
  };
}
