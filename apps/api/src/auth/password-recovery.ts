/** @spec password-recovery REQ-004..REQ-016 */
import type {
  PasswordRecoveryRequest,
  PasswordRecoveryRequestResponse,
  PasswordResetRequest,
  PasswordResetResponse,
} from '@hansel/contracts';

interface PasswordRecoveryDependencies {
  requestChallenge(input: {
    email: string;
    identifierDigest: string;
    codeDigest: string;
    expiresAt: Date;
    now: Date;
  }): Promise<
    | false
    | {
        challengeId: string;
        recipient: string;
        firstName: string | null;
      }
  >;
  resetPassword(input: {
    email: string;
    codeDigest: string;
    passwordHash: string;
    pepperVersion: number;
    now: Date;
  }): Promise<boolean>;
  createCode(): string;
  digestCode(code: string): string;
  digestIdentifier(email: string): string;
  hashPassword(password: string): Promise<string>;
  passwordPepperVersion: number;
  sendResetEmail(input: {
    recipient: string;
    firstName: string | null;
    code: string;
    challengeId: string;
  }): Promise<void>;
  schedule(task: () => void): void;
  now(): Date;
  recordEvent(name: string): void;
}

export function createPasswordRecovery(
  dependencies: PasswordRecoveryDependencies,
) {
  return {
    async request(
      input: PasswordRecoveryRequest,
    ): Promise<PasswordRecoveryRequestResponse> {
      const now = dependencies.now();
      const code = dependencies.createCode();
      const challenge = await dependencies.requestChallenge({
        email: input.email,
        identifierDigest: dependencies.digestIdentifier(input.email),
        codeDigest: dependencies.digestCode(code),
        expiresAt: new Date(now.getTime() + 15 * 60 * 1_000),
        now,
      });
      if (challenge) {
        dependencies.recordEvent('password_recovery_email_attempted');
        dependencies.schedule(() => {
          void dependencies
            .sendResetEmail({
              ...challenge,
              code,
            })
            .then(() => {
              dependencies.recordEvent('password_recovery_email_sent');
            })
            .catch(() => {
              dependencies.recordEvent('password_recovery_email_failed');
            });
        });
      } else dependencies.recordEvent('password_recovery_request_suppressed');
      dependencies.recordEvent('password_recovery_request_accepted');
      return { status: 'accepted' };
    },

    async reset(input: PasswordResetRequest): Promise<PasswordResetResponse> {
      const now = dependencies.now();
      const passwordHash = await dependencies.hashPassword(input.password);
      const accepted = await dependencies.resetPassword({
        email: input.email,
        codeDigest: dependencies.digestCode(input.code),
        passwordHash,
        pepperVersion: dependencies.passwordPepperVersion,
        now,
      });
      if (!accepted) {
        dependencies.recordEvent('password_reset_rejected');
        throw new PasswordResetRejectedError();
      }
      dependencies.recordEvent('password_reset_succeeded');
      return { destination: '/login' };
    },
  };
}

export class PasswordResetRejectedError extends Error {
  readonly code = 'password_reset_rejected';
}
