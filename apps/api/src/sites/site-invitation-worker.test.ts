import { describe, expect, it, vi } from 'vitest';
import { createSiteInvitationWorker } from './site-invitation-worker.js';

describe('site invitation worker [sites-add-new REQ-015]', () => {
  it('polls without overlap, reports failure, and starts/stops idempotently', async () => {
    let tick: (() => void) | undefined;
    let finish: (() => void) | undefined;
    const timer = {};
    const runOnce = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error('private'));
    const schedule = vi.fn((callback: () => void) => {
      tick = callback;
      return timer;
    });
    const cancel = vi.fn();
    const recordEvent = vi.fn();
    const worker = createSiteInvitationWorker({
      runOnce,
      schedule,
      cancel,
      recordEvent,
    });
    worker.stop();
    worker.start();
    worker.start();
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), 1_000);
    tick?.();
    tick?.();
    expect(runOnce).toHaveBeenCalledOnce();
    finish?.();
    await Promise.resolve();
    await Promise.resolve();
    tick?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(recordEvent).toHaveBeenCalledWith('site_invitation_worker_failure');
    worker.stop();
    worker.stop();
    expect(cancel).toHaveBeenCalledOnce();
  });
});
