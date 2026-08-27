import { describe, expect, it, vi } from 'vitest';
import {
  createOrganizationProfile,
  createOrganizationProfileDigests,
  OrganizationProfileConflictError,
  OrganizationProfileTransitionError,
} from './organization-profile.js';

const input = {
  organizationName: 'Hansel',
  country: 'AU',
  industry: 'healthcare' as const,
  placeService: 'clinics',
  organizationSize: 'employees_11_50' as const,
  submissionKey: 'submission-key-with-enough-entropy-123456',
};

const setup = (
  result:
    | 'created'
    | 'replay-initial'
    | 'replay-current'
    | 'conflict'
    | 'rejected' = 'created',
) => {
  const recordEvent = vi.fn();
  const prepare = vi.fn().mockResolvedValue(true);
  const save = vi.fn().mockResolvedValue(result);
  const module = createOrganizationProfile({
    prepare,
    save,
    createSubmissionKey: () => input.submissionKey,
    digestSubmissionKey: (value) => `submission:${value}`,
    digestRequest: (value) => `request:${value}`,
    digestOnboardingCredential: (value) => `credential:${value}`,
    deriveOnboardingCredential: (credential, key) => `${credential}:${key}`,
    createOnboardingCsrfProof: (value) => `csrf:${value}`,
    verifyOnboardingCsrfProof: (_credential, proof) => proof === 'proof',
    now: () => new Date('2026-08-27T00:00:00Z'),
    recordEvent,
  });
  return { module, prepare, save, recordEvent };
};

describe('organization profile [onboarding-organization-profile REQ-006..REQ-010, REQ-017]', () => {
  it('loads server-owned catalogs with a prepared submission key', async () => {
    const { module, prepare, recordEvent } = setup();
    const page = await module.load('credential');
    expect(page.submissionKey).toBe(input.submissionKey);
    expect(page.countries).toHaveLength(249);
    expect(page.placesByIndustry.healthcare).toHaveLength(3);
    expect(prepare).toHaveBeenCalledWith({
      credentialDigest: 'credential:credential',
      submissionKeyDigest: `submission:${input.submissionKey}`,
      now: new Date('2026-08-27T00:00:00Z'),
      expiresAt: new Date('2026-08-27T00:15:00Z'),
    });
    expect(recordEvent).toHaveBeenCalledWith(
      'organization_profile_page_loaded',
    );
  });

  it('rejects an unavailable page and invalid CSRF proof', async () => {
    const unavailable = setup();
    unavailable.prepare.mockResolvedValue(false);
    await expect(unavailable.module.load('credential')).rejects.toBeInstanceOf(
      OrganizationProfileTransitionError,
    );
    await expect(
      unavailable.module.submit('credential', 'wrong', input),
    ).rejects.toBeInstanceOf(OrganizationProfileTransitionError);
    expect(unavailable.save).not.toHaveBeenCalled();
  });

  it.each([
    ['created', 'organization_profile_created'],
    ['replay-initial', 'organization_profile_idempotent_replay'],
  ] as const)('returns discovery for %s', async (result, event) => {
    const { module, save, recordEvent } = setup(result);
    await expect(module.submit('credential', 'proof', input)).resolves.toEqual({
      nextStep: 'discovery',
      onboardingCredential: `credential:${input.submissionKey}`,
      csrfProof: `csrf:credential:${input.submissionKey}`,
    });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        credentialDigest: 'credential:credential',
        submissionKeyDigest: `submission:${input.submissionKey}`,
        requestDigest: expect.stringContaining('request:'),
      }),
    );
    expect(recordEvent).toHaveBeenCalledWith(event);
  });

  it('keeps the already-rotated credential unchanged on a current replay', async () => {
    const { module } = setup('replay-current');
    await expect(module.submit('current', 'proof', input)).resolves.toEqual({
      nextStep: 'discovery',
      onboardingCredential: 'current',
      csrfProof: 'proof',
    });
  });

  it.each([
    [
      'conflict',
      OrganizationProfileConflictError,
      'organization_profile_conflict',
    ],
    [
      'rejected',
      OrganizationProfileTransitionError,
      'organization_profile_transition_rejected',
    ],
  ] as const)('maps %s safely', async (result, ErrorType, event) => {
    const { module, recordEvent } = setup(result);
    await expect(
      module.submit('credential', 'proof', input),
    ).rejects.toBeInstanceOf(ErrorType);
    expect(recordEvent).toHaveBeenCalledWith(event);
  });

  it('creates domain-separated stable digests', () => {
    const digests = createOrganizationProfileDigests('secret');
    expect(digests.digestRequest('value')).toBe(digests.digestRequest('value'));
    expect(digests.digestRequest('value')).not.toBe(
      digests.digestSubmissionKey('value'),
    );
  });
});
