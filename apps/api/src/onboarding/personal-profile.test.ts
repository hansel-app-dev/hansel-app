import { describe, expect, it, vi } from 'vitest';
import {
  createPersonalProfile,
  createPersonalProfileLoader,
  PersonalProfileTransitionError,
} from './personal-profile.js';

const profile = {
  firstName: 'Nabin',
  lastName: 'Singh',
  jobTitle: 'manager' as const,
  department: 'marketing_communications' as const,
};
const rotation = {
  createOnboardingCredential: () => 'next-credential',
  createOnboardingCsrfProof: () => 'next-csrf',
};

describe('personal profile [REQ-037, REQ-040, REQ-086]', () => {
  it('loads an accepted profile through the continuation credential [REQ-011, REQ-014]', async () => {
    const load = vi.fn().mockResolvedValue({ profile });
    const loader = createPersonalProfileLoader({
      load,
      digestOnboardingCredential: (value) => `digest:${value}`,
      now: () => new Date('2026-08-27T02:00:00Z'),
    });

    await expect(loader('credential')).resolves.toEqual({ profile });
    expect(load).toHaveBeenCalledWith({
      credentialDigest: 'digest:credential',
      now: new Date('2026-08-27T02:00:00Z'),
    });
  });

  it('rejects an unavailable profile continuation generically [REQ-014]', async () => {
    const loader = createPersonalProfileLoader({
      load: vi.fn().mockResolvedValue(null),
      digestOnboardingCredential: vi.fn(),
      now: vi.fn(),
    });

    await expect(loader('invalid')).rejects.toBeInstanceOf(
      PersonalProfileTransitionError,
    );
  });

  it('persists the profile through the authenticated transition', async () => {
    const save = vi.fn().mockResolvedValue(true);
    const submit = createPersonalProfile({
      save,
      ...rotation,
      digestOnboardingCredential: (value) => `digest:${value}`,
      verifyOnboardingCsrfProof: () => true,
      now: () => new Date('2026-08-27T02:00:00Z'),
    });

    await expect(submit('credential', 'csrf-proof', profile)).resolves.toEqual({
      nextStep: 'plan-selection',
      onboardingCredential: 'next-credential',
      csrfProof: 'next-csrf',
    });
    expect(save).toHaveBeenCalledWith({
      credentialDigest: 'digest:credential',
      nextCredentialDigest: 'digest:next-credential',
      nextCredentialExpiresAt: new Date('2026-08-27T02:15:00Z'),
      now: new Date('2026-08-27T02:00:00Z'),
      profile,
    });
  });

  it('rejects an invalid or wrong-step continuation generically', async () => {
    const submit = createPersonalProfile({
      save: vi.fn().mockResolvedValue(false),
      ...rotation,
      digestOnboardingCredential: vi.fn(),
      verifyOnboardingCsrfProof: () => true,
      now: () => new Date(),
    });

    await expect(
      submit('invalid', 'csrf-proof', profile),
    ).rejects.toBeInstanceOf(PersonalProfileTransitionError);
  });

  it('rejects cross-session CSRF proof without accessing persistence [REQ-029]', async () => {
    const save = vi.fn();
    const submit = createPersonalProfile({
      save,
      ...rotation,
      digestOnboardingCredential: vi.fn(),
      verifyOnboardingCsrfProof: () => false,
      now: vi.fn(),
    });
    await expect(
      submit('credential', 'wrong-proof', profile),
    ).rejects.toBeInstanceOf(PersonalProfileTransitionError);
    expect(save).not.toHaveBeenCalled();
  });
});
