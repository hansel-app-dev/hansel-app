import { describe, expect, it, vi } from 'vitest';
import { createPasswordLockEmailWorker } from './password-lock-email-worker.js';

describe('password lock email worker [user-login REQ-010]', () => {
  it('polls without overlap, reports failures, and stops idempotently', async () => {
    let tick: (() => void) | undefined;
    let finish: (() => void) | undefined;
    const timer = { id: 'timer' };
    const runOnce = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error('private detail'));
    const schedule = vi.fn((callback: () => void) => {
      tick = callback;
      return timer;
    });
    const cancel = vi.fn();
    const recordEvent = vi.fn();
    const worker = createPasswordLockEmailWorker({
      runOnce,
      schedule,
      cancel,
      recordEvent,
    });

    worker.stop();
    worker.start();
    worker.start();
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), 1_000);
    expect(schedule).toHaveBeenCalledTimes(1);

    tick?.();
    tick?.();
    expect(runOnce).toHaveBeenCalledTimes(1);
    finish?.();
    await Promise.resolve();
    await Promise.resolve();

    tick?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(runOnce).toHaveBeenCalledTimes(2);
    expect(recordEvent).toHaveBeenCalledWith(
      'password_lock_email_worker_failure',
    );

    worker.stop();
    worker.stop();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith(timer);
  });
});
