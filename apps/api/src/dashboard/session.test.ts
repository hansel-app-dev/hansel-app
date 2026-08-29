import { describe, expect, it, vi } from 'vitest';
import { createDashboardSession } from './session.js';

describe('dashboard application session [dashboard-home REQ-005, REQ-010, REQ-011]', () => {
  it('returns current viewer display values for a valid access credential', async () => {
    const authorizeAccess = vi.fn().mockResolvedValue({
      firstName: 'Nabin',
      lastName: 'Singh',
      roleId: 'owner',
    });
    const rotateRefresh = vi.fn();
    const session = createDashboardSession({
      authorizeAccess,
      rotateRefresh,
      createCredential: () => 'unused',
      digestCredential: (value) => `digest:${value}`,
      now: () => new Date('2026-08-29T00:00:00.000Z'),
      recordEvent: vi.fn(),
    });

    await expect(
      session.load({ accessCredential: 'access', refreshCredential: null }),
    ).resolves.toEqual({
      viewer: {
        displayName: 'Nabin Singh',
        initials: 'NS',
        roleLabel: 'Owner',
      },
    });
    expect(authorizeAccess).toHaveBeenCalledWith({
      credentialDigest: 'digest:access',
      now: new Date('2026-08-29T00:00:00.000Z'),
    });
    expect(rotateRefresh).not.toHaveBeenCalled();
  });

  it('rotates one valid refresh credential when access is unavailable', async () => {
    const authorizeAccess = vi.fn().mockResolvedValue(null);
    const rotateRefresh = vi.fn().mockResolvedValue({
      status: 'accepted',
      viewer: {
        firstName: 'Élodie',
        lastName: '陈',
        roleId: 'editor',
      },
    });
    const createCredential = vi
      .fn()
      .mockReturnValueOnce('new-access')
      .mockReturnValueOnce('new-refresh');
    const recordEvent = vi.fn();
    const session = createDashboardSession({
      authorizeAccess,
      rotateRefresh,
      createCredential,
      digestCredential: (value) => `digest:${value}`,
      now: () => new Date('2026-08-29T00:00:00.000Z'),
      recordEvent,
    });

    await expect(
      session.load({
        accessCredential: 'expired-access',
        refreshCredential: 'refresh',
      }),
    ).resolves.toEqual({
      viewer: {
        displayName: 'Élodie 陈',
        initials: 'É陈',
        roleLabel: 'Editor',
      },
      applicationSession: {
        accessCredential: 'new-access',
        refreshCredential: 'new-refresh',
      },
    });
    expect(rotateRefresh).toHaveBeenCalledWith({
      credentialDigest: 'digest:refresh',
      accessCredentialDigest: 'digest:new-access',
      refreshCredentialDigest: 'digest:new-refresh',
      now: new Date('2026-08-29T00:00:00.000Z'),
      accessExpiresAt: new Date('2026-08-29T00:15:00.000Z'),
      refreshExpiresAt: new Date('2026-09-28T00:00:00.000Z'),
    });
    expect(recordEvent).toHaveBeenCalledWith('dashboard_refresh_succeeded');
  });

  it('fails closed without credentials or when refresh is rejected', async () => {
    const authorizeAccess = vi.fn().mockResolvedValue(null);
    const rotateRefresh = vi.fn().mockResolvedValue({ status: 'rejected' });
    const recordEvent = vi.fn();
    const session = createDashboardSession({
      authorizeAccess,
      rotateRefresh,
      createCredential: vi
        .fn()
        .mockReturnValueOnce('new-access')
        .mockReturnValueOnce('new-refresh'),
      digestCredential: (value) => `digest:${value}`,
      now: () => new Date('2026-08-29T00:00:00.000Z'),
      recordEvent,
    });

    await expect(
      session.load({ accessCredential: null, refreshCredential: null }),
    ).resolves.toBeNull();
    await expect(
      session.load({ accessCredential: null, refreshCredential: 'rejected' }),
    ).resolves.toBeNull();
    expect(recordEvent).toHaveBeenCalledWith('dashboard_refresh_failed');
    expect(authorizeAccess).not.toHaveBeenCalled();
    expect(rotateRefresh).toHaveBeenCalledOnce();
  });

  it('records an operational refresh failure without exposing details', async () => {
    const recordEvent = vi.fn();
    const session = createDashboardSession({
      authorizeAccess: vi.fn().mockResolvedValue(null),
      rotateRefresh: vi
        .fn()
        .mockRejectedValue(new Error('database unavailable')),
      createCredential: vi.fn().mockReturnValue('opaque'),
      digestCredential: (value) => `digest:${value}`,
      now: () => new Date('2026-08-29T00:00:00.000Z'),
      recordEvent,
    });

    await expect(
      session.load({ accessCredential: null, refreshCredential: 'refresh' }),
    ).rejects.toThrow('database unavailable');
    expect(recordEvent).toHaveBeenCalledWith('dashboard_refresh_failed');
  });
});
