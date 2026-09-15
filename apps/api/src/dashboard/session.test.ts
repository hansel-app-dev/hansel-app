import { describe, expect, it, vi } from 'vitest';
import { createDashboardSession } from './session.js';

describe('dashboard application session [dashboard-home REQ-005, REQ-010, REQ-011]', () => {
  it('revokes the represented session families using only credential digests [dashboard-logout REQ-005, REQ-008]', async () => {
    const revokeFamilies = vi.fn().mockResolvedValue(undefined);
    const recordEvent = vi.fn();
    const session = createDashboardSession({
      authorizeAccess: vi.fn(),
      rotateRefresh: vi.fn(),
      revokeFamilies,
      createCredential: () => 'unused',
      digestCredential: (value) => `digest:${value}`,
      now: () => new Date('2026-08-29T00:00:00.000Z'),
      recordEvent,
    });

    await expect(
      session.logout({
        accessCredential: 'access',
        refreshCredential: 'refresh',
      }),
    ).resolves.toBeUndefined();
    expect(revokeFamilies).toHaveBeenCalledWith({
      credentialDigests: ['digest:access', 'digest:refresh'],
      now: new Date('2026-08-29T00:00:00.000Z'),
    });
    expect(recordEvent).toHaveBeenCalledWith('dashboard_logout_succeeded');
  });

  it('succeeds without persistence when no credentials are present [dashboard-logout REQ-007]', async () => {
    const revokeFamilies = vi.fn();
    const recordEvent = vi.fn();
    const session = createDashboardSession({
      authorizeAccess: vi.fn(),
      rotateRefresh: vi.fn(),
      revokeFamilies,
      createCredential: () => 'unused',
      digestCredential: (value) => `digest:${value}`,
      now: () => new Date('2026-08-29T00:00:00.000Z'),
      recordEvent,
    });

    await expect(
      session.logout({ accessCredential: null, refreshCredential: null }),
    ).resolves.toBeUndefined();
    expect(revokeFamilies).not.toHaveBeenCalled();
    expect(recordEvent).toHaveBeenCalledWith('dashboard_logout_succeeded');
  });

  it('records a redacted logout failure and permits retry [dashboard-logout REQ-008]', async () => {
    const recordEvent = vi.fn();
    const session = createDashboardSession({
      authorizeAccess: vi.fn(),
      rotateRefresh: vi.fn(),
      revokeFamilies: vi
        .fn()
        .mockRejectedValue(new Error('database unavailable')),
      createCredential: () => 'unused',
      digestCredential: (value) => `digest:${value}`,
      now: () => new Date('2026-08-29T00:00:00.000Z'),
      recordEvent,
    });

    await expect(
      session.logout({ accessCredential: 'secret', refreshCredential: null }),
    ).rejects.toThrow('database unavailable');
    expect(recordEvent).toHaveBeenCalledWith('dashboard_logout_failed');
    expect(recordEvent).not.toHaveBeenCalledWith(
      expect.stringContaining('secret'),
    );
  });

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
      revokeFamilies: vi.fn(),
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

  it('projects the private Organization tray summary only when enabled [organization-tray-settings REQ-012, REQ-017]', async () => {
    const identity = {
      firstName: 'Nabin',
      lastName: 'Singh',
      roleId: 'administrator',
      email: 'owner@example.com',
      organizationName: 'Hansel',
      planId: 'plus',
    };
    const dependencies = {
      authorizeAccess: vi.fn().mockResolvedValue(identity),
      rotateRefresh: vi.fn(),
      revokeFamilies: vi.fn(),
      createCredential: () => 'unused',
      digestCredential: (value: string) => `digest:${value}`,
      now: () => new Date('2026-09-07T00:00:00.000Z'),
      recordEvent: vi.fn(),
      organizationTraySettingsEnabled: true,
    };
    await expect(
      createDashboardSession(dependencies).load({
        accessCredential: 'access',
        refreshCredential: null,
      }),
    ).resolves.toEqual({
      viewer: {
        displayName: 'Nabin Singh',
        initials: 'NS',
        roleLabel: 'Administrator',
        email: 'owner@example.com',
      },
      organization: { name: 'Hansel', planDisplayName: 'Plus Plan' },
    });
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
      revokeFamilies: vi.fn(),
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
      revokeFamilies: vi.fn(),
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
      revokeFamilies: vi.fn(),
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
