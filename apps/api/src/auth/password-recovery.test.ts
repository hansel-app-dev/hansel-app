import { describe, expect, it, vi } from 'vitest';
import {
  createPasswordRecovery,
  PasswordResetRejectedError,
} from './password-recovery.js';

function dependencies() {
  return {
    requestChallenge: vi.fn(),
    resetPassword: vi.fn(),
    createCode: vi.fn().mockReturnValue('123456'),
    digestCode: vi.fn().mockReturnValue('code-digest'),
    digestIdentifier: vi.fn().mockReturnValue('identifier-digest'),
    hashPassword: vi.fn().mockResolvedValue('new-password-hash'),
    passwordPepperVersion: 1,
    sendResetEmail: vi.fn().mockResolvedValue(undefined),
    schedule: (task: () => void) => {
      task();
    },
    now: vi.fn().mockReturnValue(new Date('2026-08-31T12:00:00.000Z')),
    recordEvent: vi.fn(),
  };
}

describe('password recovery [password-recovery REQ-004..REQ-016]', () => {
  it('issues and sends one eligible challenge behind a generic response', async () => {
    const deps = dependencies();
    deps.requestChallenge.mockResolvedValue({
      challengeId: 'challenge-id',
      recipient: 'owner@example.com',
      firstName: 'Ava',
    });
    const recovery = createPasswordRecovery(deps);

    await expect(
      recovery.request({ email: 'owner@example.com' }),
    ).resolves.toEqual({ status: 'accepted' });
    expect(deps.requestChallenge).toHaveBeenCalledWith({
      email: 'owner@example.com',
      identifierDigest: 'identifier-digest',
      codeDigest: 'code-digest',
      expiresAt: new Date('2026-08-31T12:15:00.000Z'),
      now: new Date('2026-08-31T12:00:00.000Z'),
    });
    expect(deps.sendResetEmail).toHaveBeenCalledWith({
      recipient: 'owner@example.com',
      firstName: 'Ava',
      code: '123456',
      challengeId: 'challenge-id',
    });
    expect(deps.recordEvent).toHaveBeenCalledWith(
      'password_recovery_email_sent',
    );
    expect(deps.recordEvent).toHaveBeenCalledWith(
      'password_recovery_email_attempted',
    );
    expect(deps.recordEvent).toHaveBeenCalledWith(
      'password_recovery_request_accepted',
    );
  });

  it('keeps the accepted response generic when delivery fails', async () => {
    const deps = dependencies();
    deps.requestChallenge.mockResolvedValue({
      challengeId: 'challenge-id',
      recipient: 'owner@example.com',
      firstName: null,
    });
    deps.sendResetEmail.mockRejectedValue(new Error('private provider detail'));
    const recovery = createPasswordRecovery(deps);

    await expect(
      recovery.request({ email: 'owner@example.com' }),
    ).resolves.toEqual({ status: 'accepted' });
    expect(deps.recordEvent).toHaveBeenCalledWith(
      'password_recovery_email_failed',
    );
  });

  it('does not couple the generic response to provider completion', async () => {
    const deps = dependencies();
    deps.requestChallenge.mockResolvedValue({
      challengeId: 'challenge-id',
      recipient: 'owner@example.com',
      firstName: null,
    });
    let finishDelivery: () => void = () => undefined;
    deps.sendResetEmail.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishDelivery = resolve;
        }),
    );
    const recovery = createPasswordRecovery(deps);

    await expect(
      recovery.request({ email: 'owner@example.com' }),
    ).resolves.toEqual({ status: 'accepted' });
    expect(deps.recordEvent).not.toHaveBeenCalledWith(
      'password_recovery_email_sent',
    );
    finishDelivery();
    await vi.waitFor(() => {
      expect(deps.recordEvent).toHaveBeenCalledWith(
        'password_recovery_email_sent',
      );
    });
  });

  it('suppresses ineligible or rate-limited delivery behind acceptance', async () => {
    const deps = dependencies();
    deps.requestChallenge.mockResolvedValue(false);
    const recovery = createPasswordRecovery(deps);

    await expect(
      recovery.request({ email: 'unknown@example.com' }),
    ).resolves.toEqual({ status: 'accepted' });
    expect(deps.sendResetEmail).not.toHaveBeenCalled();
    expect(deps.recordEvent).toHaveBeenCalledWith(
      'password_recovery_request_suppressed',
    );
    expect(deps.recordEvent).toHaveBeenCalledWith(
      'password_recovery_request_accepted',
    );
  });

  it('hashes and atomically applies one accepted reset', async () => {
    const deps = dependencies();
    deps.resetPassword.mockResolvedValue(true);
    const recovery = createPasswordRecovery(deps);

    await expect(
      recovery.reset({
        email: 'owner@example.com',
        code: '123456',
        password: 'Correct horse battery staple!7',
      }),
    ).resolves.toEqual({ destination: '/login' });
    expect(deps.hashPassword).toHaveBeenCalledWith(
      'Correct horse battery staple!7',
    );
    expect(deps.resetPassword).toHaveBeenCalledWith({
      email: 'owner@example.com',
      codeDigest: 'code-digest',
      passwordHash: 'new-password-hash',
      pepperVersion: 1,
      now: new Date('2026-08-31T12:00:00.000Z'),
    });
    expect(deps.recordEvent).toHaveBeenCalledWith('password_reset_succeeded');
  });

  it('maps every refused reset to one domain rejection', async () => {
    const deps = dependencies();
    deps.resetPassword.mockResolvedValue(false);
    const recovery = createPasswordRecovery(deps);

    await expect(
      recovery.reset({
        email: 'unknown@example.com',
        code: '123456',
        password: 'Correct horse battery staple!7',
      }),
    ).rejects.toBeInstanceOf(PasswordResetRejectedError);
    expect(deps.recordEvent).toHaveBeenCalledWith('password_reset_rejected');
  });
});
