import { describe, expect, it, vi } from 'vitest';
import {
  createDiscovery,
  createDiscoveryDigests,
  DiscoveryConflictError,
  DiscoveryTransitionError,
} from './discovery.js';

const submissionKey = 'submission-key-with-enough-entropy-123456';

function setup(
  result: 'created' | 'replay' | 'conflict' | 'rejected' = 'created',
) {
  const prepare = vi.fn().mockResolvedValue(true);
  const complete = vi.fn().mockResolvedValue(result);
  const recordEvent = vi.fn();
  const module = createDiscovery({
    prepare,
    complete,
    createSubmissionKey: () => submissionKey,
    digestSubmissionKey: (value) => `submission:${value}`,
    digestRequest: (value) => `request:${value}`,
    digestOnboardingCredential: (value) => `credential:${value}`,
    verifyOnboardingCsrfProof: (_credential, proof) => proof === 'proof',
    now: () => new Date('2026-08-28T00:00:00Z'),
    recordEvent,
  });
  return { module, prepare, complete, recordEvent };
}

describe('discovery [onboarding-discovery REQ-005..REQ-010, REQ-018]', () => {
  it('loads the approved methods with a prepared submission key', async () => {
    const { module, prepare, recordEvent } = setup();
    await expect(module.load('credential')).resolves.toEqual({
      submissionKey,
      methods: [
        { id: 'pdf', label: 'PDF' },
        { id: 'spreadsheet', label: 'Spreadsheet' },
        { id: 'other', label: 'Other' },
      ],
    });
    expect(prepare).toHaveBeenCalledWith({
      credentialDigest: 'credential:credential',
      submissionKeyDigest: `submission:${submissionKey}`,
      now: new Date('2026-08-28T00:00:00Z'),
      expiresAt: new Date('2026-08-28T00:15:00Z'),
    });
    expect(recordEvent).toHaveBeenCalledWith('discovery_page_loaded');
  });

  it('rejects an unavailable page and invalid CSRF proof', async () => {
    const unavailable = setup();
    unavailable.prepare.mockResolvedValue(false);
    await expect(unavailable.module.load('credential')).rejects.toBeInstanceOf(
      DiscoveryTransitionError,
    );
    await expect(
      unavailable.module.complete('credential', 'wrong', {
        action: 'skip',
        submissionKey,
      }),
    ).rejects.toBeInstanceOf(DiscoveryTransitionError);
    expect(unavailable.complete).not.toHaveBeenCalled();
  });

  it.each([
    [
      'submit',
      {
        action: 'submit' as const,
        currentManagement: 'other' as const,
        currentManagementOther: 'Signage platform',
        challenges: 'Version control',
        submissionKey,
      },
      {
        outcome: 'submitted',
        currentManagement: 'other',
        currentManagementOther: 'Signage platform',
        challenges: 'Version control',
      },
      'discovery_submitted_completion',
    ],
    [
      'skip',
      { action: 'skip' as const, submissionKey },
      {
        outcome: 'skipped',
        currentManagement: null,
        currentManagementOther: null,
        challenges: null,
      },
      'discovery_skipped_completion',
    ],
  ])('completes an accepted %s', async (_name, input, answers, event) => {
    const { module, complete, recordEvent } = setup();
    await expect(
      module.complete('credential', 'proof', input),
    ).resolves.toEqual({ nextStep: 'dashboard', destination: '/dashboard' });
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        credentialDigest: 'credential:credential',
        submissionKeyDigest: `submission:${submissionKey}`,
        requestDigest: expect.stringContaining('request:'),
        answers,
      }),
    );
    expect(recordEvent).toHaveBeenCalledWith(event);
  });

  it('normalizes an omitted optional challenge to null', async () => {
    const { module, complete } = setup();
    await module.complete('credential', 'proof', {
      action: 'submit',
      currentManagement: 'pdf',
      submissionKey,
    });
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: expect.objectContaining({ challenges: null }),
      }),
    );
    await module.complete('credential', 'proof', {
      action: 'submit',
      currentManagement: 'pdf',
      challenges: undefined,
      submissionKey,
    });
  });

  it.each([
    ['replay', 'discovery_idempotent_replay', null],
    ['conflict', 'discovery_conflict', DiscoveryConflictError],
    ['rejected', 'discovery_transition_rejected', DiscoveryTransitionError],
  ] as const)('maps %s safely', async (result, event, ErrorType) => {
    const { module, recordEvent } = setup(result);
    const promise = module.complete('credential', 'proof', {
      action: 'skip',
      submissionKey,
    });
    if (ErrorType) await expect(promise).rejects.toBeInstanceOf(ErrorType);
    else
      await expect(promise).resolves.toEqual({
        nextStep: 'dashboard',
        destination: '/dashboard',
      });
    expect(recordEvent).toHaveBeenCalledWith(event);
  });

  it('creates domain-separated stable digests', () => {
    const digests = createDiscoveryDigests('secret');
    expect(digests.digestRequest('value')).toBe(digests.digestRequest('value'));
    expect(digests.digestRequest('value')).not.toBe(
      digests.digestSubmissionKey('value'),
    );
  });
});
