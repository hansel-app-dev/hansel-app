import { describe, expect, it, vi } from 'vitest';
import { createWelcomeEmailWorker } from './welcome-email-worker.js';

describe('Welcome email worker [onboarding-welcome-email REQ-004, REQ-006, REQ-014]', () => {
  it('polls without overlap, reports safe failures, and stops cleanly', async () => {
    let tick: (() => void) | undefined;
    const timer = { id: 'timer' };
    const schedule = vi.fn((callback: () => void) => {
      tick = callback;
      return timer;
    });
    const cancel = vi.fn();
    let finishFirst: (() => void) | undefined;
    const runOnce = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishFirst = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error('private database detail'));
    const recordEvent = vi.fn();
    const worker = createWelcomeEmailWorker({
      runOnce,
      schedule,
      cancel,
      intervalMs: 1_000,
      recordEvent,
    });

    worker.start();
    worker.start();
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), 1_000);

    tick?.();
    tick?.();
    expect(runOnce).toHaveBeenCalledTimes(1);
    finishFirst?.();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    tick?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(runOnce).toHaveBeenCalledTimes(2);
    expect(recordEvent).toHaveBeenCalledWith(
      'welcome_email_worker_unexpected_failure',
    );

    worker.stop();
    worker.stop();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith(timer);
  });
});
