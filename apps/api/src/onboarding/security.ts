import { createHmac, randomInt } from 'node:crypto';
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
  };
}
