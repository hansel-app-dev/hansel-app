import { describe, expect, it, vi } from 'vitest';
import { createSiteInvitationDispatcher } from './site-invitation-dispatcher.js';

const now = new Date('2026-09-01T12:00:00Z');
const delivery = {
  deliveryId: 'delivery-id',
  invitationId: 'invitation-id',
  recipient: 'viewer@example.com',
  organizationName: 'Hansel',
  siteName: 'Sydney',
  expiresAt: new Date('2026-09-08T12:00:00Z'),
  attempts: 1,
};

function harness(overrides = {}) {
  const dependencies = {
    claim: vi.fn().mockResolvedValue(delivery),
    markDelivered: vi.fn().mockResolvedValue(true),
    markRetry: vi.fn().mockResolvedValue(true),
    markTerminal: vi.fn().mockResolvedValue(true),
    createToken: vi.fn().mockReturnValue('private-token'),
    send: vi.fn().mockResolvedValue('provider-id'),
    workerId: 'worker-id',
    now: () => now,
    jitter: () => 0.5,
    recordEvent: vi.fn(),
    ...overrides,
  };
  return {
    dependencies,
    dispatcher: createSiteInvitationDispatcher(dependencies),
  };
}

describe('site invitation dispatcher [sites-add-new REQ-015]', () => {
  it('is idle without work and delivers a claimed invitation without logging private fields', async () => {
    await expect(
      harness({ claim: vi.fn().mockResolvedValue(null) }).dispatcher.runOnce(),
    ).resolves.toBe('idle');
    const h = harness();
    await expect(h.dispatcher.runOnce()).resolves.toBe('delivered');
    expect(h.dependencies.send).toHaveBeenCalledWith({
      invitationId: 'invitation-id',
      recipient: 'viewer@example.com',
      organizationName: 'Hansel',
      siteName: 'Sydney',
      token: 'private-token',
    });
    expect(h.dependencies.markDelivered).toHaveBeenCalledWith({
      deliveryId: 'delivery-id',
      workerId: 'worker-id',
      providerId: 'provider-id',
      deliveredAt: now,
    });
    expect(JSON.stringify(h.dependencies.recordEvent.mock.calls)).not.toContain(
      'viewer@example.com',
    );
    expect(JSON.stringify(h.dependencies.recordEvent.mock.calls)).not.toContain(
      'private-token',
    );
  });

  it.each([
    [0, '2026-09-01T12:00:45Z'],
    [1, '2026-09-01T12:01:15Z'],
  ])('jitters retry delay within its bound (%s)', async (jitter, next) => {
    const h = harness({
      jitter: () => jitter,
      send: vi.fn().mockRejectedValue(new Error('provider failure')),
    });
    await h.dispatcher.runOnce();
    expect(h.dependencies.markRetry).toHaveBeenCalledWith(
      expect.objectContaining({ nextAttemptAt: new Date(next) }),
    );
  });

  it.each([
    [{ ...delivery, expiresAt: now }, 'expired'],
    [{ ...delivery, attempts: 6 }, 'retry_exhausted'],
  ])('terminates expired or exhausted work', async (claimed, reason) => {
    const h = harness({ claim: vi.fn().mockResolvedValue(claimed) });
    await expect(h.dispatcher.runOnce()).resolves.toBe('terminal');
    expect(h.dependencies.markTerminal).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: reason }),
    );
    expect(h.dependencies.send).not.toHaveBeenCalled();
  });

  it('retries provider failure with bounded backoff and reports a lost lease safely', async () => {
    const h = harness({
      send: vi.fn().mockRejectedValue(new Error('provider detail')),
      markRetry: vi.fn().mockResolvedValue(false),
    });
    await expect(h.dispatcher.runOnce()).resolves.toBe('retry');
    expect(h.dependencies.markRetry).toHaveBeenCalledWith({
      deliveryId: 'delivery-id',
      workerId: 'worker-id',
      nextAttemptAt: new Date('2026-09-01T12:01:00Z'),
      errorCode: 'provider_failure',
    });
    expect(h.dependencies.recordEvent).toHaveBeenCalledWith(
      'site_invitation_lease_lost',
      expect.objectContaining({ category: 'lease_lost' }),
    );
  });

  it('terminates the fifth failed attempt and handles a lost delivery transition', async () => {
    const exhausted = harness({
      claim: vi.fn().mockResolvedValue({ ...delivery, attempts: 5 }),
      send: vi.fn().mockRejectedValue(new Error('failure')),
    });
    await expect(exhausted.dispatcher.runOnce()).resolves.toBe('terminal');
    const lost = harness({ markDelivered: vi.fn().mockResolvedValue(false) });
    await expect(lost.dispatcher.runOnce()).resolves.toBe('delivered');
    expect(lost.dependencies.recordEvent).toHaveBeenCalledWith(
      'site_invitation_lease_lost',
      expect.any(Object),
    );
  });
});
