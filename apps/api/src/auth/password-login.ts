/** @spec user-login REQ-005..REQ-011, REQ-018 */
import type { LoginDestination, LoginRequest } from '@hansel/contracts';

interface PasswordLoginAccount {
  userId: string;
  passwordHash: string;
  lockedUntil: Date | null;
}

interface LoginCompletion {
  destination: LoginDestination;
  sessionKind: 'application' | 'onboarding' | 'verification';
}

interface PasswordLoginDependencies {
  loadAccount(email: string): Promise<PasswordLoginAccount | null>;
  verifyPassword(passwordHash: string, password: string): Promise<boolean>;
  dummyPasswordHash: string;
  recordFailure(input: { userId: string; now: Date }): Promise<void>;
  completeSuccess(input: {
    userId: string;
    expectedPasswordHash: string;
    now: Date;
    accessCredentialDigest: string;
    accessExpiresAt: Date;
    refreshCredentialDigest: string;
    absoluteExpiresAt: Date;
    onboardingCredentialDigest: string;
    onboardingExpiresAt: Date;
  }): Promise<LoginCompletion | null>;
  requestVerification(email: string): Promise<void>;
  createApplicationCredential(): string;
  digestApplicationCredential(value: string): string;
  createOnboardingCredential(): string;
  digestOnboardingCredential(value: string): string;
  createOnboardingCsrfProof(value: string): string;
  now(): Date;
  recordEvent(name: string): void;
}

export type PasswordLoginResult =
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

export function createPasswordLogin(dependencies: PasswordLoginDependencies) {
  return async function login(
    input: LoginRequest,
  ): Promise<PasswordLoginResult> {
    const now = dependencies.now();
    const account = await dependencies.loadAccount(input.email);
    if (!account) {
      await dependencies.verifyPassword(
        dependencies.dummyPasswordHash,
        input.password,
      );
      dependencies.recordEvent('password_login_rejected');
      return { status: 'rejected' };
    }
    if (account.lockedUntil && account.lockedUntil > now) {
      await dependencies.verifyPassword(
        dependencies.dummyPasswordHash,
        input.password,
      );
      dependencies.recordEvent('password_login_rejected');
      return { status: 'rejected' };
    }
    if (
      !(await dependencies.verifyPassword(account.passwordHash, input.password))
    ) {
      await dependencies.recordFailure({ userId: account.userId, now });
      dependencies.recordEvent('password_login_rejected');
      return { status: 'rejected' };
    }

    const accessCredential = dependencies.createApplicationCredential();
    const refreshCredential = dependencies.createApplicationCredential();
    const onboardingCredential = dependencies.createOnboardingCredential();
    const completion = await dependencies.completeSuccess({
      userId: account.userId,
      expectedPasswordHash: account.passwordHash,
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
      dependencies.recordEvent('password_login_rejected');
      return { status: 'rejected' };
    }
    if (completion.sessionKind === 'verification') {
      await dependencies.requestVerification(input.email);
      dependencies.recordEvent('password_login_succeeded');
      return { status: 'accepted', destination: completion.destination };
    }
    if (completion.sessionKind === 'onboarding') {
      dependencies.recordEvent('password_login_succeeded');
      return {
        status: 'accepted',
        destination: completion.destination,
        onboardingSession: {
          onboardingCredential,
          csrfProof:
            dependencies.createOnboardingCsrfProof(onboardingCredential),
        },
      };
    }
    dependencies.recordEvent('password_login_succeeded');
    return {
      status: 'accepted',
      destination: completion.destination,
      applicationSession: { accessCredential, refreshCredential },
    };
  };
}
